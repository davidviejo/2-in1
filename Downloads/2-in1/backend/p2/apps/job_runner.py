import threading
import time
import logging
import json
import traceback
import concurrent.futures
from typing import Dict, Any, List

from apps.core.database import (
    get_next_queued_job, update_job_status, get_job_items_by_status,
    update_item_status, update_job_progress, get_job
)
from apps.web.blueprints.api_engine.seo_checklist_orchestrator import run_orchestrated_checklist
from apps.core.config import Config
from apps.ai_visibility_runner import process_ai_visibility_schedules

_RUNNER_STARTED = False
_RUNNER_THREAD = None
_RUNNER_LOCK = threading.Lock()

class JobRunner:
    @staticmethod
    def start_worker():
        """Starts the background worker thread if not already running."""
        global _RUNNER_STARTED, _RUNNER_THREAD
        with _RUNNER_LOCK:
            if _RUNNER_STARTED:
                if _RUNNER_THREAD and _RUNNER_THREAD.is_alive():
                    logging.info("JobRunner already active.")
                    return

                restart_reason = "missing_thread_reference"
                if _RUNNER_THREAD and not _RUNNER_THREAD.is_alive():
                    restart_reason = "thread_not_alive"

                logging.warning(
                    f"JobRunner worker restarted; reason={restart_reason}"
                )

            thread = threading.Thread(target=JobRunner._worker_loop, daemon=True)
            thread.start()
            _RUNNER_THREAD = thread
            _RUNNER_STARTED = True
            logging.info("JobRunner started.")

    @staticmethod
    def runner_health():
        """Returns basic health info for the in-process runner."""
        thread_name = _RUNNER_THREAD.name if _RUNNER_THREAD else None
        return {
            "started": _RUNNER_STARTED,
            "thread_alive": bool(_RUNNER_THREAD and _RUNNER_THREAD.is_alive()),
            "thread_name": thread_name,
        }

    @staticmethod
    def _worker_loop():
        """Main loop for the worker."""
        logging.info("JobRunner loop initialized.")
        while True:
            try:
                job = get_next_queued_job()
                if job:
                    JobRunner.process_job(job)
                else:
                    process_ai_visibility_schedules()
                    time.sleep(Config.JOBS_POLL_INTERVAL)
            except Exception as e:
                logging.error(f"Error in JobRunner loop: {e}")
                time.sleep(Config.JOBS_POLL_INTERVAL)

    @staticmethod
    def process_job(job: Dict[str, Any]):
        """
        Processes a single job.
        """
        job_id = job['job_id']
        logging.info(f"Starting job {job_id}")

        try:
            update_job_status(job_id, 'running')
        except Exception as e:
            logging.error(f"Failed to set job {job_id} to running: {e}")
            return

        try:
            # Get items
            items = get_job_items_by_status(job_id, 'queued')
            if not items:
                update_job_status(job_id, 'completed')
                return

            # Configuration
            config = job.get('analysis_config', {}) or {}
            advanced_allowed = bool(job.get('advanced_allowed'))

            # If advanced is not allowed, ensure config reflects that
            if not advanced_allowed:
                 # Force standard mode
                 if config.get('mode') == 'advanced':
                     config['mode'] = 'standard'
                 if 'serp' in config:
                     config['serp']['confirmed'] = False

            # GSC Queries are expected to be in analysis_config under 'gscQueriesByUrl'
            gsc_queries_map = config.get('gscQueriesByUrl', {})

            cancel_flag = False

            # Use ThreadPoolExecutor for concurrent items
            max_workers = Config.JOBS_CONCURRENCY_LIMIT
            with concurrent.futures.ThreadPoolExecutor(max_workers=max_workers) as executor:
                pending_items = list(items)
                active_futures = []

                while pending_items or active_futures:
                    # Check job status periodically
                    current_job = get_job(job_id)
                    if not current_job:
                        logging.error(f"Job {job_id} disappeared!")
                        break

                    if current_job['status'] == 'cancelled':
                        logging.info(f"Job {job_id} cancelled.")
                        cancel_flag = True
                        break

                    if current_job['status'] == 'paused':
                        logging.info(f"Job {job_id} paused. Waiting...")
                        time.sleep(Config.JOBS_POLL_INTERVAL)
                        continue

                    # Submit new tasks if slots available
                    while len(active_futures) < max_workers and pending_items:
                        item = pending_items.pop(0)
                        future = executor.submit(JobRunner.process_single_item, item, config, gsc_queries_map, advanced_allowed)
                        active_futures.append(future)

                    # Wait briefly for completions
                    done, _ = concurrent.futures.wait(active_futures, timeout=1, return_when=concurrent.futures.FIRST_COMPLETED)

                    for future in done:
                        active_futures.remove(future)
                        try:
                            future.result()
                        except Exception as e:
                            logging.error(f"Error in item future: {e}")

                    if not pending_items and not active_futures:
                        break

                    # Sleep slightly to avoid busy loop if waiting
                    if not done:
                        time.sleep(0.5)

                if cancel_flag:
                    # Cancel remaining
                    for f in active_futures:
                        f.cancel()
                    # Mark pending as skipped
                    for item in pending_items:
                        update_item_status(item['item_id'], 'skipped')
                    return

            # Final status check
            final_job = get_job(job_id)
            if final_job['status'] not in ['cancelled', 'paused', 'failed']:
                 update_job_status(job_id, 'completed')
                 logging.info(f"Job {job_id} completed.")

        except Exception as e:
            logging.error(f"Job {job_id} failed with exception: {e}\n{traceback.format_exc()}")
            update_job_status(job_id, 'failed', last_error=str(e))

    @staticmethod
    def process_single_item(item, config, gsc_queries_map, advanced_allowed):
        item_id = item['item_id']
        url = item['url']
        page_id = item['page_id']
        resolved_page_id = page_id or item_id or url

        try:
            update_item_status(item_id, 'running')

            # Extract metadata
            meta = {}
            if item.get('item_metadata'):
                try:
                    meta = json.loads(item['item_metadata'])
                except (json.JSONDecodeError, TypeError):
                    pass

            kw = meta.get('kwPrincipal', '')
            p_type = meta.get('pageType', 'Otro')
            geo = meta.get('geoTarget', '')
            cluster = meta.get('cluster', '')
            analyze_competitors = bool(meta.get('analyzeCompetitors', False))
            competitor_urls = meta.get('competitorUrls', [])

            # Get GSC queries for this URL.
            # Precedence:
            # 1) Item-level metadata (new format): item_metadata.gscQueries
            # 2) Job-level map (legacy format): analysis_config.gscQueriesByUrl[url]
            gsc_queries = meta.get('gscQueries')
            if gsc_queries is None:
                gsc_queries = gsc_queries_map.get(url, [])

            result = run_orchestrated_checklist(
                url=url,
                kwPrincipal=kw,
                pageType=p_type,
                geoTarget=geo,
                cluster=cluster,
                gscQueries=gsc_queries,
                analyze_competitors=analyze_competitors,
                competitor_urls=competitor_urls,
                analysis_config=config
            )

            # Ensure frontend-compatible AnalysisResponse shape.
            if isinstance(result, dict) and 'pageId' in result and 'items' in result:
                wrapped_result = dict(result)
                wrapped_result['pageId'] = wrapped_result.get('pageId') or resolved_page_id
                wrapped_result.setdefault('url', url)
            else:
                wrapped_result = {
                    'pageId': resolved_page_id,
                    'items': result if isinstance(result, dict) else {},
                    'url': url,
                    'generatedAt': time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime()),
                }

                if isinstance(result, dict):
                    for key in ('advancedBlockedReason', 'advancedExecuted', 'engineMeta'):
                        if key in result:
                            wrapped_result[key] = result[key]

            update_item_status(item_id, 'done', result=wrapped_result)
            update_job_progress(item['job_id'], success_inc=1, processed_inc=1)

        except Exception as e:
            logging.error(f"Item {item_id} ({url}) failed: {e}")
            update_item_status(item_id, 'error', error=str(e))
            update_job_progress(item['job_id'], error_inc=1, processed_inc=1)
