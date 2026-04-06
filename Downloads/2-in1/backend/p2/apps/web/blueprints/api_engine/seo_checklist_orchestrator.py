import os
import logging
import concurrent.futures
import re
import json
import requests
from flask import current_app
from typing import Dict, Any, List, Optional
from bs4 import BeautifulSoup
from collections import Counter
from urllib.parse import urlparse, urljoin

# Tools imports
from apps.tools.scraper_core import fetch_url_hybrid
from apps.web.blueprints.checklist_tool import check_url_compliance
from apps.web.blueprints.pixel_tool import check_px
from apps.web.blueprints.structure_tool import get_struct
from apps.web.blueprints.wpo_tool import check_wpo
from apps.web.blueprints.schema_detector import detect_schemas
from apps.web.blueprints.image_audit import scan_imgs
from apps.web.blueprints.readability_tool import analyze_text_visual
from apps.web.blueprints.kw_intent import classify_keyword
from apps.web.blueprints.seo_tool import scrape_page, text_similarity, dispatcher, classify_intent, cluster_serp_results, get_domain
from apps.core.database import get_user_settings
from apps.web.blueprints.schema_tool import analyze_structured_data_detailed

def safe_execute(func, *args, **kwargs):
    try:
        return func(*args, **kwargs)
    except Exception as e:
        func_name = getattr(func, '__name__', str(func))
        logging.error(f"Execution failed for {func_name}: {e}")
        return {"error": str(e)}

def check_dependency_error(*deps):
    for d in deps:
        if isinstance(d, dict) and d.get('error'):
            return d['error']
    return None

def run_orchestrated_checklist(
    url: str,
    kwPrincipal: str,
    pageType: str,
    geoTarget: str = None,
    cluster: str = None,
    gscQueries: List[Dict] = None,
    analyze_competitors: bool = False,
    competitor_urls: List[str] = None,
    serp_api_confirmed: bool = False,
    serp_provider: str = None,
    analysis_config: Dict[str, Any] = None
) -> Dict[str, Any]:
    """
    Orchestrates the SEO checklist analysis by calling specialized tools.
    """
    # 1. Fetch content for logic-based checks (Readability, Geo in text, etc.)
    fetched = fetch_url_hybrid(url)
    content = fetched.get('content')
    soup = BeautifulSoup(content, 'html.parser') if content else None
    text_content = soup.get_text(" ", strip=True) if soup else ""

    # --- CONFIG & GUARDRAILS (Advanced Analysis) ---
    try:
        user_settings = get_user_settings()
    except Exception as exc:
        logging.warning(f"Falling back to default user settings during checklist analysis: {exc}")
        user_settings = {}

    advanced_mode = False
    advanced_blocked_reason = None
    serp_cfg = {}
    applied_limits = {}
    provider_used = None
    request_serp_section = (analysis_config or {}).get('serp', {}) if analysis_config else {}
    request_dfs_login = request_serp_section.get('dataforseoLogin')
    request_dfs_pass = request_serp_section.get('dataforseoPassword')

    resolved_serpapi_key = user_settings.get('serpapi_key') or os.environ.get('SERPAPI_KEY')
    resolved_dfs_login = request_dfs_login or user_settings.get('dataforseo_login') or os.environ.get('DATAFORSEO_LOGIN')
    resolved_dfs_pass = request_dfs_pass or user_settings.get('dataforseo_password') or os.environ.get('DATAFORSEO_PASSWORD')

    if analysis_config:
        mode = analysis_config.get('mode')
        serp_section = analysis_config.get('serp', {})

        if mode == 'advanced' and serp_section.get('confirmed'):
            # Check credentials (ENV or DB)
            provider = serp_section.get('provider')
            has_creds = False

            if provider == 'serpapi':
                has_creds = bool(resolved_serpapi_key)
            elif provider == 'dataforseo':
                has_creds = bool(resolved_dfs_login and resolved_dfs_pass)
            elif provider == 'internal':
                has_creds = True # Internal always allowed (scraping)
            elif provider == 'google_official':
                has_creds = bool(user_settings.get('cse_key') and user_settings.get('cse_cx'))

            if has_creds:
                advanced_mode = True
                provider_used = provider

                # Apply Limits
                max_kw_env = current_app.config.get('ENGINE_MAX_KEYWORDS_PER_URL', 20)
                max_comp_env = current_app.config.get('ENGINE_MAX_COMPETITORS_PER_KEYWORD', 5)

                req_kw = int(serp_section.get('maxKeywordsPerUrl', 20))
                req_comp = int(serp_section.get('maxCompetitorsPerKeyword', 5))

                final_kw = min(req_kw, max_kw_env)
                final_comp = min(req_comp, max_comp_env)

                serp_cfg = serp_section.copy()
                serp_cfg['maxKeywordsPerUrl'] = final_kw
                serp_cfg['maxCompetitorsPerKeyword'] = final_comp

                applied_limits = {
                    'maxKeywordsPerUrl': final_kw,
                    'maxCompetitorsPerKeyword': final_comp
                }
            else:
                advanced_blocked_reason = f"Provider '{provider}' credentials missing."
        else:
            if mode != 'advanced': advanced_blocked_reason = "Mode not advanced."
            elif not serp_section.get('confirmed'): advanced_blocked_reason = "SERP not confirmed."
    else:
        # Fallback to legacy args
        if analyze_competitors or serp_api_confirmed:
            advanced_mode = True
            # Apply defaults for legacy calls too
            max_kw_env = current_app.config.get('ENGINE_MAX_KEYWORDS_PER_URL', 20)
            max_comp_env = current_app.config.get('ENGINE_MAX_COMPETITORS_PER_KEYWORD', 5)

            serp_cfg = {
                'provider': serp_provider or 'dataforseo',
                'maxKeywordsPerUrl': min(10, max_kw_env),
                'maxCompetitorsPerKeyword': min(3, max_comp_env)
            }
            provider_used = serp_cfg['provider']
            applied_limits = {
                'maxKeywordsPerUrl': serp_cfg['maxKeywordsPerUrl'],
                'maxCompetitorsPerKeyword': serp_cfg['maxCompetitorsPerKeyword']
            }

    # 2. Run specialized tools in parallel
    results = {}

    with concurrent.futures.ThreadPoolExecutor(max_workers=10) as executor:
        # Submit tasks
        futures = {
            executor.submit(safe_execute, check_url_compliance, url): 'checklist',
            executor.submit(safe_execute, check_px, url): 'pixel',
            executor.submit(safe_execute, get_struct, url): 'structure',
            executor.submit(safe_execute, check_wpo, url): 'wpo',
            executor.submit(safe_execute, detect_schemas, url): 'schema',
            executor.submit(safe_execute, scan_imgs, url): 'images',
            # Readability needs text content
            executor.submit(safe_execute, analyze_text_visual, text_content): 'readability',
            # Intent needs title/keyword
            executor.submit(safe_execute, classify_keyword, soup.title.string if soup and soup.title else kwPrincipal): 'intent'
        }

        for future in concurrent.futures.as_completed(futures):
            key = futures[future]
            try:
                results[key] = future.result()
            except Exception as e:
                logging.error(f"Error in {key}: {e}")
                results[key] = {'error': str(e)}

    # 3. Aggregate Results into Expected Structure

    # CLUSTER
    cluster_res = {
        "autoData": {"cluster_input": cluster},
        "recommendation": "Manual review required for cluster alignment.",
        "suggested_status": "PARCIAL",
        "status": "PARCIAL"
    }

    checklist_res = results.get('checklist', {})
    schema_data = results.get('schema', {})

    # GEOLOCALIZACION (PUNTO 2)
    # Use helper for new requirements
    geo_res = _analyze_geo_detailed(soup, geoTarget, text_content, checklist_res, schema_data)


    # DATOS_ESTRUCTURADOS (PUNTO 3)
    # Re-analyze to catch JSON errors not returned by detect_schemas
    schema_res_block = analyze_structured_data_detailed(soup, schema_data)

    # CONTENIDOS (PUNTO 4)
    readability = results.get('readability', {})
    if check_dependency_error(readability):
        content_res = {"error": readability['error']}
    else:
        read_stats = readability.get('stats', {})
        content_res = {
            "autoData": {
                "word_count": read_stats.get('words', 0),
                "keyword_density": 0,
                "keyword_count": 0,
                "readability_score": read_stats.get('score', 0),
                "readability_level": read_stats.get('level', 'N/A')
            },
            "recommendation": "Existe una plantilla de contenidos en la zona de aprendizaje que analiza competencia y estructura semántica. Se recomienda trabajar esta URL mediante dicha plantilla además de este análisis automático.",
            "status": "GOOD" if read_stats.get('score', 0) > 60 else "IMPROVE"
        }
        if kwPrincipal and text_content:
            kw_count = text_content.lower().count(kwPrincipal.lower())
            length = len(text_content.split())
            density = round((kw_count / length) * 100, 2) if length > 0 else 0
            content_res['autoData']['keyword_count'] = kw_count
            content_res['autoData']['keyword_density'] = density

        # --- COMPETITOR ANALYSIS (PUNTO 4 EXTENDED) ---
        comp_data_list = []
        if advanced_mode:
            target_urls = competitor_urls or [] # Legacy or provided

            limit_comp = int(serp_cfg.get('maxCompetitorsPerKeyword', 3))

            # Fetch from SERP if needed
            if not target_urls and kwPrincipal:
                try:
                    cfg = {
                        'mode': serp_cfg.get('provider', 'dataforseo'),
                        'serp_provider': serp_cfg.get('provider', 'dataforseo'),
                        'gl': geoTarget or 'es',
                        'hl': 'es',
                        'cse_key': resolved_serpapi_key,
                        'serpapi_key': resolved_serpapi_key,
                        'dfs_login': resolved_dfs_login,
                        'dfs_pass': resolved_dfs_pass,
                        'top_n': limit_comp + 2 # Fetch a bit more
                    }
                    serp_res = dispatcher(kwPrincipal, cfg)
                    if isinstance(serp_res, list):
                        target_urls = [r['url'] for r in serp_res[:limit_comp] if r.get('url')]
                except Exception as e:
                    logging.error(f"Error fetching SERP for competitors: {e}")
                    content_res['recommendation'] += " Error obteniendo competidores de SERP."

            if not target_urls:
                 content_res['recommendation'] += " No se encontraron competidores."
            else:
                # Analyze Competitors
                with concurrent.futures.ThreadPoolExecutor(max_workers=5) as comp_executor:
                    # Analyze OUR URL first to get compatible structure
                    our_future = comp_executor.submit(scrape_page, url)

                    # Analyze Competitors
                    comp_futures = {comp_executor.submit(scrape_page, u): u for u in target_urls}

                    our_data = our_future.result()

                    competitors_struct = []
                    for f in concurrent.futures.as_completed(comp_futures):
                        url_c = comp_futures[f]
                        try:
                            res = f.result()
                            if res:
                                # Map fields to requested format
                                if 'headings' in res:
                                     res['outline'] = res['headings']
                                if 'words' in res:
                                     res['wordCount'] = res['words']

                                comp_data_list.append(res)
                                competitors_struct.append({
                                    "competitorUrl": url_c,
                                    "domain": get_domain(url_c),
                                    "data": res
                                })
                        except Exception as e:
                            logging.error(f"Error analyzing competitor: {e}")

                    # Compare
                    if our_data and comp_data_list:
                        # Gap Headings
                        our_headings = set(h['text'].lower() for h in our_data.get('headings', []))
                        gap_headings = []
                        for c in comp_data_list:
                            for h in c.get('headings', []):
                                if h['text'].lower() not in our_headings:
                                    gap_headings.append(h['text'])

                        # Semantic Coverage (Entities)
                        our_entities = set(our_data.get('entities', []))
                        all_comp_entities = set()
                        for c in comp_data_list:
                            all_comp_entities.update(c.get('entities', []))

                        coverage_score = len(our_entities.intersection(all_comp_entities)) / len(all_comp_entities) if all_comp_entities else 1.0

                        # Structure Similarity
                        sim_scores = []
                        our_struct_str = "\n".join(our_data.get('structure', []))
                        for c in comp_data_list:
                            c_struct_str = "\n".join(c.get('structure', []))
                            sim_scores.append(text_similarity(our_struct_str, c_struct_str))

                        avg_sim = sum(sim_scores) / len(sim_scores) if sim_scores else 0

                        # Use set for uniqueness
                        unique_gap_headings = list(set(gap_headings))[:20]

                        # Update Result with Requested Fields
                        content_res['autoData'].update({
                            'competitors': competitors_struct,
                            'competitorUrlsUsed': target_urls,
                            'competitorOutlines': [c.get('headings', []) for c in comp_data_list],
                            'gapSections': unique_gap_headings,
                            'gapHeadings': unique_gap_headings, # Keep legacy
                            'coverageScore': round(coverage_score * 100, 2),
                            'semanticCoverageScore': round(coverage_score * 100, 2), # Keep legacy
                            'similarityScore': round(avg_sim * 100, 2),
                            'contentSimilarityScore': round(avg_sim * 100, 2), # Keep legacy
                            'missingSections': [], # Placeholder: detailed structure gap analysis is complex, using gapHeadings instead
                            'competitorCount': len(comp_data_list)
                        })
        elif advanced_blocked_reason:
            content_res['recommendation'] += f" Análisis avanzado bloqueado: {advanced_blocked_reason}"

    # SNIPPETS
    pixel = results.get('pixel', {})
    err = check_dependency_error(pixel, checklist_res)
    if err:
        snippet_res = {"error": err}
    else:
        checklist_snip = checklist_res.get('snippet', {})
        snippet_res = {
            "autoData": {
                "title": checklist_snip.get('Title', ''),
                "title_length": len(checklist_snip.get('Title', '')),
                "description": checklist_snip.get('Desc', ''),
                "description_length": len(checklist_snip.get('Desc', '')),
                "pixel_title": pixel.get('t_px', 0),
                "pixel_desc": pixel.get('d_px', 0),
                "status_title": pixel.get('t_stat', 'N/A'),
                "status_desc": pixel.get('d_stat', 'N/A')
            },
            "recommendation": "Optimize title and description length (pixels).",
            "status": "GOOD" if pixel.get('t_stat') == 'OK' and pixel.get('d_stat') == 'OK' else "IMPROVE"
        }

    # IMAGENES
    imgs_detailed = results.get('images', {})
    if check_dependency_error(imgs_detailed):
        img_res = {"error": imgs_detailed['error']}
    else:
        imgs_list = imgs_detailed.get('images', [])
        total_imgs = len(imgs_list)
        missing_alt = sum(1 for i in imgs_list if not i.get('alt'))

        img_res = {
            "autoData": {
                "total_images": total_imgs,
                "missing_alt": missing_alt,
                "lazy_load_count": 0,
                "details_sample": imgs_list[:5]
            },
            "recommendation": "Add Alt text to all images.",
            "status": "GOOD" if missing_alt == 0 else "FIX"
        }

    # ENLAZADO_INTERNO (PUNTO 7)
    # No dependency on checklist_tool anymore, uses soup from main fetch
    internal_links_data = _analyze_internal_links(soup, url)
    internal_res = {
        "autoData": internal_links_data,
        "recommendation": "Existe una plantilla de enlazado interno en Google Drive para planificación profunda del interlinking.",
        "status": "INFO"
    }

    # ESTRUCTURA
    struct_data = results.get('structure', {})
    if check_dependency_error(struct_data):
        struct_res = {"error": struct_data['error']}
    else:
        headers = struct_data.get('headers', [])
        h1_count = sum(1 for h in headers if h.get('tag') == 'H1')
        struct_res = {
            "autoData": {"h1_count": h1_count, "outline": headers},
            "recommendation": "Use exactly one H1.",
            "status": "GOOD" if h1_count == 1 else "FIX"
        }

    # UX
    ux_res = _analyze_ux(soup)

    # WPO
    wpo = results.get('wpo', {})
    if check_dependency_error(wpo):
        wpo_res = {"error": wpo['error']}
    else:
        wpo_res = {
            "autoData": {"html_size_kb": wpo.get('size', 0), "ttfb": wpo.get('ttfb', 0)},
            "recommendation": "Keep HTML under 100KB and TTFB under 0.5s.",
            "status": "GOOD" if wpo.get('size', 0) < 100 else "IMPROVE"
        }

    # ENLACE
    enlace_res = {
        "autoData": {},
        "recommendation": "Manual check of backlink profile required.",
        "status": "INFO"
    }

    # OPORTUNIDADES_VS_KW_OBJETIVO (PUNTO 12)
    intent = results.get('intent', {})
    if check_dependency_error(intent):
        opt_res = {"error": intent['error']}
    else:
        # GSC Analysis
        top_queries = []
        kw_in_gsc = False
        matched_queries = []
        zero_click_kws = []
        serp_opp_analysis = []
        api_cost = 0

        if gscQueries:
            # Sort by clicks desc
            sorted_gsc = sorted(gscQueries, key=lambda x: x.get('clicks', 0), reverse=True)
            top_queries = sorted_gsc[:5]

            # Zero Click High Impression (Imp > 50, Clicks = 0)
            zero_click_kws = [q for q in gscQueries if q.get('impressions', 0) > 50 and q.get('clicks', 0) == 0]
            zero_click_kws.sort(key=lambda x: x.get('impressions', 0), reverse=True)

            if kwPrincipal:
                kw_in_gsc = any(q.get('query', '').lower() == kwPrincipal.lower() for q in sorted_gsc)

            if text_content:
                text_lower = text_content.lower()
                for q in sorted_gsc:
                    query_text = q.get('query', '').lower()
                    if query_text and query_text in text_lower:
                        matched_queries.append(q)

            # SERP Analysis for Strategy (Updated for Item 12 Clustering)
            clustering_output = {}
            clustering_status_msg = ""

            # Check if Clustering Requested (Item 12 specific)
            is_clustering_requested = (
                advanced_mode and
                serp_cfg.get('enabled') is True and
                serp_cfg.get('confirmed') is True
            )

            if is_clustering_requested:
                # 1. Check Provider
                if serp_cfg.get('provider') != 'dataforseo':
                     clustering_status_msg = "Provider must be 'dataforseo' for clustering."
                elif not (resolved_dfs_login and resolved_dfs_pass):
                     clustering_status_msg = "DataForSEO credentials missing."
                else:
                    # 2. Run Clustering
                    try:
                        limit_kw = min(int(serp_cfg.get('maxKeywordsPerUrl', 20)), 20)
                        top_n = int(serp_cfg.get('topN', 10))
                        strict = int(serp_cfg.get('strict', 3))
                        country = serp_cfg.get('country', 'ES')
                        lang = serp_cfg.get('language', 'es')

                        target_kws = zero_click_kws[:limit_kw]

                        cfg = {
                            'mode': 'dataforseo',
                            'dfs_login': resolved_dfs_login,
                            'dfs_pass': resolved_dfs_pass,
                            'top_n': top_n,
                            'gl': country,
                            'hl': lang
                        }

                        serp_data_map = {}

                        def fetch_serp_safe(k_obj):
                             kw = k_obj.get('query')
                             if not kw: return None
                             try:
                                 res = dispatcher(kw, cfg)
                                 return (kw, res)
                             except Exception:
                                 return (kw, [])

                        with concurrent.futures.ThreadPoolExecutor(max_workers=5) as executor:
                             futures = {executor.submit(fetch_serp_safe, k): k for k in target_kws}
                             for future in concurrent.futures.as_completed(futures):
                                 try:
                                     r = future.result()
                                     if r and r[0]:
                                         serp_data_map[r[0]] = r[1]
                                 except Exception: pass

                        # Count API calls (keywords attempted)
                        api_cost += len(target_kws)

                        # Cluster
                        current_domain = get_domain(url)
                        clusters_raw = cluster_serp_results(
                            serp_data_map,
                            strict_level=strict,
                            target_domain=current_domain
                        )

                        # Format Output
                        formatted_clusters = []
                        owned_count = 0
                        opp_count = 0

                        for c in clusters_raw:
                            is_opportunity = (c.get('coverage') == 'OPPORTUNITY')
                            if is_opportunity: opp_count += 1
                            else: owned_count += 1

                            action = "CREATE_NEW_URL" if is_opportunity else "IMPROVE_CURRENT_URL"
                            notes = f"Cluster {'Oportunidad' if is_opportunity else 'Owned'}: {c.get('parent')}"

                            top_urls = [u['url'] for u in c.get('serp_dump', [])[:5] if isinstance(u, dict) and 'url' in u]

                            formatted_clusters.append({
                                "clusterId": c.get('id'),
                                "keywords": list(set([c.get('parent')] + c.get('children', []))),
                                "serpOverlapSummary": {"minCommonUrls": strict},
                                "owned": not is_opportunity,
                                "opportunity": is_opportunity,
                                "topUrlsSample": top_urls,
                                "action": action,
                                "notes": notes,
                                "intent": c.get('intent')
                            })

                        clustering_output = {
                            "source": "gsc_zero_click",
                            "selectedKeywords": [{"query": k['query'], "impressions": k['impressions'], "position": k.get('position')} for k in target_kws],
                            "clustering": {
                                "provider": "dataforseo",
                                "country": country,
                                "language": lang,
                                "topN": top_n,
                                "strict": strict
                            },
                            "clusters": formatted_clusters,
                            "summary": {
                                "totalKeywords": len(target_kws),
                                "totalClusters": len(clusters_raw),
                                "ownedClusters": owned_count,
                                "opportunityClusters": opp_count
                            },
                            "apiCallsEstimated": len(target_kws),
                            "apiProviderCostHint": "approx $0.0006 per keyword"
                        }
                    except Exception as e:
                        logging.error(f"Clustering error: {e}")
                        clustering_status_msg = f"Clustering error: {str(e)}"

            # Fallback to old logic if clustering NOT performed (and advanced mode is on)
            if not clustering_output and advanced_mode and zero_click_kws:
                limit_kw = int(serp_cfg.get('maxKeywordsPerUrl', 20))

                cfg = {
                    'mode': serp_cfg.get('provider', 'dataforseo'),
                    'serp_provider': serp_cfg.get('provider', 'dataforseo'),
                    'gl': geoTarget or 'es',
                    'hl': 'es',
                    'serpapi_key': resolved_serpapi_key,
                    'dfs_login': resolved_dfs_login,
                    'dfs_pass': resolved_dfs_pass,
                    'top_n': 10
                }

                # Analyze top K zero-click keywords
                for q_obj in zero_click_kws[:limit_kw]:
                    q_text = q_obj.get('query')
                    if not q_text: continue

                    # Cost accumulation (approx)
                    api_cost += 1

                    try:
                        q_intent = classify_intent(q_text)
                        s_res = dispatcher(q_text, cfg)

                        # Dominant type logic (simple heuristic)
                        dominant = "General"
                        serp_features = [] # Placeholder as existing tool doesn't extract them easily

                        if isinstance(s_res, list) and s_res:
                            titles = " ".join([r.get('title', '').lower() for r in s_res])
                            if "comprar" in titles or "precio" in titles or "tienda" in titles:
                                dominant = "E-commerce"
                            elif "cómo" in titles or "guía" in titles:
                                dominant = "Blog/Info"

                        # Heuristics for Recommended Action and Needs New URL
                        rec_action = "Optimizar contenido actual"
                        needs_new_url = False

                        # Logic: If query intent matches current page type, optimize. Else new URL.
                        # Simple heuristic: If dominant type != pageType (approx), then new url?
                        # We don't have pageType mapped to dominant types perfectly.
                        # Let's use simple string check.

                        p_type_lower = (pageType or "").lower()
                        if dominant == "E-commerce" and "blog" in p_type_lower:
                             needs_new_url = True
                             rec_action = "Crear ficha de producto o categoría"
                        elif dominant == "Blog/Info" and "producto" in p_type_lower:
                             needs_new_url = True
                             rec_action = "Crear artículo informativo"
                        elif "Unknown" in q_intent:
                             rec_action = "Investigar intención manual"

                        serp_opp_analysis.append({
                            'keyword': q_text,
                            'intent': q_intent,
                            'dominantType': dominant,
                            'contentTypeDominant': dominant, # Alias
                            'serpFeatures': serp_features,
                            'recommendedAction': rec_action,
                            'needsNewUrl': needs_new_url,
                            'topResult': s_res[0]['url'] if s_res and isinstance(s_res, list) else None,
                            'impressions': q_obj.get('impressions')
                        })
                    except Exception as e:
                        logging.error(f"Error in SERP strategy analysis: {e}")

        final_recommendation = "Revisar keywords con altas impresiones y 0 clics para crear contenido específico."
        # Safe access to clustering_output
        if 'clustering_output' in locals() and clustering_output:
            c_summ = clustering_output.get('summary', {})
            opps = c_summ.get('opportunityClusters', 0)
            if opps > 0:
                final_recommendation = f"Se detectaron {opps} clusters de oportunidad. Considerar crear nuevas URLs para atacarlos."
        elif 'clustering_status_msg' in locals() and clustering_status_msg:
            final_recommendation += f" (Clustering skipped: {clustering_status_msg})"

        # Safe access to clustering_output for queriesAnalyzed
        queries_analyzed = len(serp_opp_analysis)
        if 'clustering_output' in locals() and clustering_output:
             queries_analyzed = clustering_output.get('summary', {}).get('totalKeywords', 0)

        opt_res_data = {
            "detected_intents": [intent.get('intent', 'Unknown')],
            "topQueries": top_queries,
            "kwPrincipalInGSC": kw_in_gsc,
            "matchedQueries": matched_queries,
            "zeroClickHighImpressionKeywords": zero_click_kws[:10],
            "serpOpportunityAnalysis": serp_opp_analysis,
            "estimatedApiCost": api_cost,
            "queriesAnalyzed": queries_analyzed
        }

        # Merge clustering output
        if 'clustering_output' in locals() and clustering_output:
            opt_res_data.update(clustering_output)

        opt_res = {
            "autoData": opt_res_data,
            "recommendation": final_recommendation,
            "status": "INFO"
        }

    # SEMANTICA (PUNTO 13)
    sem_res = {
        "autoData": {
            "top_terms": [],
            "overlapWithContent": [],
            "competitorTerms": [],
            "missingEntities": [],
            "semanticGapTerms": []
        },
        "recommendation": "Existe plantilla semántica conectada con Search Console para trabajo profundo de entidades y términos relacionados.",
        "status": "INFO"
    }

    if text_content:
        words = re.findall(r'\w+', text_content.lower())
        common = Counter([w for w in words if len(w) > 3]).most_common(10)
        # Fix Item 4: Dict structure instead of tuples
        sem_res['autoData']['top_terms'] = [{"term": t, "count": c} for t, c in common]

        if gscQueries:
            text_lower = text_content.lower()
            overlap = []
            for q in gscQueries:
                q_text = q.get('query', '').lower()
                if q_text and q_text in text_lower:
                    overlap.append(q_text)
            sem_res['autoData']['overlapWithContent'] = overlap

        # Competitor Semantic Analysis (Reuse comp_data_list from Point 4)
        if 'comp_data_list' in locals() and comp_data_list:
            all_comp_words = []
            all_comp_entities = set()

            for c in comp_data_list:
                # Entities
                all_comp_entities.update(c.get('entities', []))
                # Heuristic for top terms from structure or entities if full text not available in simple scrape
                # But scrape_page returns 'words' count, not full text.
                # It returns 'entities' (frequent words). We can use that.
                all_comp_words.extend(c.get('entities', []))

            # Missing Entities (in comp, not in ours)
            # 'our_data' comes from Point 4 logic
            our_ents = set()
            if 'our_data' in locals() and our_data:
                our_ents = set(our_data.get('entities', []))

            missing_ents = list(all_comp_entities - our_ents)

            # Semantic Gap Terms: Frequent terms in competitors NOT in ours
            comp_term_counts = Counter(all_comp_words)
            gap_terms = []
            our_words_set = set(w.lower() for w in words) if 'words' in locals() else set()

            for term, _ in comp_term_counts.most_common(50):
                if term.lower() not in our_words_set:
                    gap_terms.append(term)

            # Fix Item 4: Dict structure
            sem_res['autoData']['competitorTerms'] = [{"term": t, "count": c} for t, c in comp_term_counts.most_common(15)]
            sem_res['autoData']['missingEntities'] = missing_ents[:20]
            sem_res['autoData']['semanticGapTerms'] = gap_terms[:20]

    # GEOLOCALIZACION_IMAGENES (PUNTO 14)
    if check_dependency_error(imgs_detailed):
        geo_img_res = {"error": imgs_detailed['error']}
    else:
        images_list = imgs_detailed.get('images', [])

        # Check first 5 images for EXIF to avoid timeout
        exif_map = {}
        for img in images_list[:5]:
            src = img.get('src')
            if src:
                has_gps = _check_exif_gps_header(src)
                # If GPS found, likely has EXIF. Heuristic.
                exif_map[src] = {'hasExif': has_gps, 'hasGps': has_gps}

        geo_img_res = _analyze_geo_images(images_list, geoTarget, exif_map)
        geo_img_res['recommendation'] = "Existe herramienta interna para geolocalizar imágenes de forma masiva si se requiere implementación."

    # LLAMADA_A_LA_ACCION
    cta_res = _analyze_cta(soup)

    # ENGINE META (PUNTO 1 & 6)
    engine_meta = {
        "requestedProvider": serp_cfg.get('provider', 'dataforseo'),
        "usedProvider": provider_used or 'none',
        "fallbackChain": [provider_used] if provider_used else [],
        "providerFailureReasons": {},
        "competitorsAnalyzedCount": len(comp_data_list) if 'comp_data_list' in locals() else 0,
        "competitorsSkippedReason": advanced_blocked_reason if not advanced_mode else None
    }

    return {
        "engineMeta": engine_meta,
        "advancedExecuted": advanced_mode,
        "advancedBlockedReason": advanced_blocked_reason,
        "appliedLimits": applied_limits,
        "providerUsed": provider_used,
        "CLUSTER": cluster_res,
        "GEOLOCALIZACION": geo_res,
        "DATOS_ESTRUCTURADOS": schema_res_block,
        "CONTENIDOS": content_res,
        "SNIPPETS": snippet_res,
        "IMAGENES": img_res,
        "ENLAZADO_INTERNO": internal_res,
        "ESTRUCTURA": struct_res,
        "UX": ux_res,
        "WPO": wpo_res,
        "ENLACE": enlace_res,
        "OPORTUNIDADES": opt_res,
        "OPORTUNIDADES_VS_KW_OBJETIVO": opt_res,
        "SEMANTICA": sem_res,
        "GEO_IMAGENES": geo_img_res,
        "GEOLOCALIZACION_IMAGENES": geo_img_res,
        "CTA": cta_res,
        "LLAMADA_A_LA_ACCION": cta_res
    }

def _analyze_geo_detailed(soup, geo_target, text, checklist_res, schema_data):
    # 1. Existing logic
    if not geo_target:
        # even if no geo target, we must return detections
        pass

    geo_lower = geo_target.lower() if geo_target else ""
    found_in_title = False
    if soup and soup.title and soup.title.string and geo_lower:
        found_in_title = geo_lower in soup.title.string.lower()

    found_in_h1 = False
    if soup and geo_lower:
        h1 = soup.find('h1')
        if h1:
            found_in_h1 = geo_lower in h1.get_text().lower()

    found_in_text = geo_lower in text[:500].lower() if text and geo_lower else False

    # Check iframe from checklist tool
    iframe_map = False
    if checklist_res and isinstance(checklist_res, dict):
        summary = checklist_res.get('summary', {})
        if summary.get('Geolocalización') == 'SI':
            iframe_map = True

    # 2. New Logic (Point 2)

    # LocalBusiness Schema
    raw_payloads = schema_data.get('raw_payloads', [])
    local_biz_schemas = []

    def find_local_biz(obj):
        if isinstance(obj, dict):
            t = obj.get('@type')
            if t:
                types = t if isinstance(t, list) else [t]
                if 'LocalBusiness' in types or any(sub in types for sub in ['Restaurant', 'Store', 'Dentist', 'TravelAgency']):
                    # Simplify check to "LocalBusiness" or check schema.org hierarchy if needed.
                    # For now check specific "LocalBusiness" string or likely subtypes.
                    # But easiest is just checking if "LocalBusiness" string is in type value.
                    pass

            # Better approach: check if @type contains 'LocalBusiness' substring or is known subtype
            # Given constraints, let's look for exact match or list containing it.
            # But schemas can be nested.
            if t and ('LocalBusiness' in str(t)):
                local_biz_schemas.append(obj)

            for v in obj.values():
                find_local_biz(v)
        elif isinstance(obj, list):
            for item in obj:
                find_local_biz(item)

    find_local_biz(raw_payloads)
    has_local_biz = len(local_biz_schemas) > 0

    # Google Maps Iframe
    maps_iframes = []
    has_maps_iframe = False
    if soup:
        for iframe in soup.find_all('iframe'):
            src = iframe.get('src', '')
            if 'google.com/maps' in src or 'maps.google' in src:
                maps_iframes.append(str(iframe))
                has_maps_iframe = True

    # Hreflang
    hreflang_tags = []
    if soup:
        for link in soup.find_all('link', rel='alternate', hreflang=True):
            hreflang_tags.append({
                'hreflang': link.get('hreflang'),
                'href': link.get('href')
            })
    has_hreflang = len(hreflang_tags) > 0

    # Lang & Locale
    html_lang = soup.find('html').get('lang') if soup and soup.find('html') else None
    og_locale = None
    if soup:
        meta_og = soup.find('meta', property='og:locale')
        if meta_og:
            og_locale = meta_og.get('content')

    # Construct autoData
    auto_data = {
        "found_in_title": found_in_title,
        "found_in_h1": found_in_h1,
        "found_in_intro": found_in_text,
        "iframe_map_detected": iframe_map or has_maps_iframe, # Update to be true if either detected

        # New fields
        "hasLocalBusinessSchema": has_local_biz,
        "localBusinessSchemas": local_biz_schemas,
        "hasGoogleMapsIframe": has_maps_iframe,
        "mapsIframes": maps_iframes,
        "hasHreflang": has_hreflang,
        "hreflangTags": hreflang_tags,
        "htmlLang": html_lang,
        "ogLocale": og_locale
    }

    status = "GOOD" if (found_in_title or found_in_h1 or auto_data['iframe_map_detected']) else "IMPROVE"

    return {
        "autoData": auto_data,
        "recommendation": f"Ensure '{geo_target}' is in Title, H1 and map is present." if geo_target else "Define Geo Target.",
        "status": status
    }

def _analyze_ux(soup):
    has_viewport = False
    if soup:
        viewport = soup.find('meta', attrs={'name': 'viewport'})
        has_viewport = bool(viewport)

    return {
        "autoData": {"has_viewport": has_viewport},
        "recommendation": "Ensure mobile responsiveness.",
        "status": "GOOD" if has_viewport else "CRITICAL"
    }

def _analyze_geo_images(images_list, geo_target, exif_map=None):
    exif_map = exif_map or {}
    images_checked_details = []

    geo_in_src_count = 0
    geo_in_alt_count = 0
    gps_found_count = 0

    geo = geo_target.lower() if geo_target else None

    for img in images_list:
        src = img.get('src', '')
        alt = img.get('alt', '')

        src_lower = src.lower()
        alt_lower = alt.lower()

        filename_has_geo = False
        alt_has_geo = False

        if geo:
            if geo in src_lower:
                filename_has_geo = True
                geo_in_src_count += 1
            if geo in alt_lower:
                alt_has_geo = True
                geo_in_alt_count += 1

        # EXIF info
        exif_info = exif_map.get(src, {})
        has_exif = exif_info.get('hasExif', False)
        has_gps = exif_info.get('hasGps', False)

        if has_gps:
            gps_found_count += 1

        images_checked_details.append({
            "src": src,
            "alt": alt,
            "filenameHasGeo": filename_has_geo,
            "altHasGeo": alt_has_geo,
            "hasExif": has_exif,
            "hasGps": has_gps
        })

    status = "INFO"
    if geo_target:
        status = "GOOD" if (geo_in_src_count > 0 or geo_in_alt_count > 0 or gps_found_count > 0) else "IMPROVE"

    return {
        "autoData": {
            "geo_in_src": geo_in_src_count,
            "geo_in_alt": geo_in_alt_count,
            "imagesChecked": images_checked_details,
            "imagesWithGpsCount": gps_found_count
        },
        "recommendation": "Include geo target in image filenames/alt or use GPS metadata." if geo_target else "Define Geo Target.",
        "status": status
    }

def _analyze_cta(soup):
    cta_pattern = re.compile(r'reserva|cita|llamar|contacto|comprar|pedir|presupuesto', re.IGNORECASE)
    found_cta = False
    cta_text = ""

    if soup:
        for el in soup.find_all(['a', 'button']):
            text = el.get_text(strip=True)
            if cta_pattern.search(text):
                found_cta = True
                cta_text = text
                break

    return {
        "autoData": {"found_cta": found_cta, "cta_text": cta_text},
        "recommendation": "Add a clear Call to Action." if not found_cta else "CTA found.",
        "status": "GOOD" if found_cta else "FIX"
    }

def _check_exif_gps_header(url: str) -> bool:
    """
    Checks for GPS Info tag in the first 4KB of the image.
    Heuristic: looks for byte sequence 88 25 (Big Endian) or 25 88 (Little Endian).
    """
    try:
        # Timeout 2s, only first 4KB
        headers = {'Range': 'bytes=0-4096', 'User-Agent': 'Mozilla/5.0'}
        r = requests.get(url, headers=headers, timeout=2)
        if r.status_code in [200, 206]:
            data = r.content
            # GPS Info Tag ID is 0x8825.
            # In Tiff (Exif), tags are 2 bytes.
            # LE: 0x25 0x88
            # BE: 0x88 0x25
            if b'\x25\x88' in data or b'\x88\x25' in data:
                return True

            # Also check for "GPS" string which might appear in XMP
            if b'GPS' in data:
                return True

        return False
    except Exception:
        return False


def _analyze_internal_links(soup, base_url):
    """
    Analyzes internal links in the page content.
    Returns detailed information about each internal link.
    """
    if not soup:
        return {
            "internal_links_count": 0,
            "internal_links": [],
            "unique_internal_destinations": 0,
            "anchors_summary": {}
        }

    internal_links = []
    base_parsed = urlparse(base_url)
    base_domain_norm = base_parsed.netloc.removeprefix('www.')

    anchors = []

    # Iterate over all 'a' tags with href attribute
    for a in soup.find_all('a', href=True):
        href = a['href']
        # Resolve relative URL to absolute
        full_url = urljoin(base_url, href)
        parsed = urlparse(full_url)

        # Check if internal (matches base domain)
        link_domain_norm = parsed.netloc.removeprefix('www.')

        # Logic: matches normalized domain OR empty netloc (relative already joined should have base domain)
        if link_domain_norm != base_domain_norm:
             continue # External

        # Extract details
        rel_attr = a.get('rel')
        rel_raw = ""
        if isinstance(rel_attr, list):
            rel_raw = " ".join(rel_attr)
        elif isinstance(rel_attr, str):
            rel_raw = rel_attr

        rel_lower = rel_raw.lower()

        is_nofollow = "nofollow" in rel_lower
        is_ugc = "ugc" in rel_lower
        is_sponsored = "sponsored" in rel_lower

        target = a.get('target', '')
        target_blank = (target == '_blank')

        anchor_text = a.get_text(" ", strip=True)

        link_obj = {
            "href": full_url,
            "anchor": anchor_text,
            "rel": rel_attr or [], # Legacy compatibility
            "rel_raw": rel_raw,
            "is_nofollow": is_nofollow,
            "rel_flags": {
                "nofollow": is_nofollow,
                "ugc": is_ugc,
                "sponsored": is_sponsored
            },
            "target_blank": target_blank
        }

        internal_links.append(link_obj)
        anchors.append(anchor_text)

    # Summary
    count = len(internal_links)
    unique_dests = len(set(l['href'] for l in internal_links))

    # Top 20 anchors
    anchors_summary = dict(Counter(anchors).most_common(20))

    return {
        "internal_links_count": count,
        "internal_links": internal_links,
        "unique_internal_destinations": unique_dests,
        "anchors_summary": anchors_summary
    }
