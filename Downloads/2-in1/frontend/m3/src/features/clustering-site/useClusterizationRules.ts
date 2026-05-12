import { useEffect, useMemo, useState } from 'react';
import {
  buildLookerStudioClusterCase,
  buildLookerStudioClusterCaseGroupedRegex,
  buildLookerStudioClusterLevelCase,
  buildLookerStudioClusterLevelCaseGroupedRegex,
  buildLookerStudioUrlLevelCase,
  parseClusterLevelRules,
  parseCustomClusters,
} from '@/utils/gscFilters';

const CLUSTER_RULESETS_STORAGE_KEY = 'mediaflow_gsc-impact-cluster-rulesets-v1';

export type ClusterRuleset = { name: string; clusterRulesText: string; clusterLevelRulesText: string };

export const useClusterizationRules = (selectedDomain: string, clusterDepthLevels: number) => {
  const [clusterRulesText, setClusterRulesText] = useState('');
  const [clusterLevelRulesText, setClusterLevelRulesText] = useState('');
  const [clusterRulesetName, setClusterRulesetName] = useState('');
  const [clusterRulesets, setClusterRulesets] = useState<ClusterRuleset[]>([]);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(CLUSTER_RULESETS_STORAGE_KEY);
      if (!stored) return;
      const parsed = JSON.parse(stored);
      if (!Array.isArray(parsed)) return;
      setClusterRulesets(
        parsed
          .map((item) => ({
            name: typeof item?.name === 'string' ? item.name.trim() : '',
            clusterRulesText: typeof item?.clusterRulesText === 'string' ? item.clusterRulesText : '',
            clusterLevelRulesText: typeof item?.clusterLevelRulesText === 'string' ? item.clusterLevelRulesText : '',
          }))
          .filter((item) => item.name),
      );
    } catch {
      // ignore malformed storage
    }
  }, []);

  useEffect(() => {
    localStorage.setItem(CLUSTER_RULESETS_STORAGE_KEY, JSON.stringify(clusterRulesets));
  }, [clusterRulesets]);

  const parsedCustomClusters = useMemo(() => parseCustomClusters(clusterRulesText), [clusterRulesText]);
  const parsedClusterLevelRules = useMemo(() => parseClusterLevelRules(clusterLevelRulesText), [clusterLevelRulesText]);

  const lookerClusterCase = useMemo(
    () => (selectedDomain ? buildLookerStudioClusterCase(selectedDomain, parsedCustomClusters) : ''),
    [parsedCustomClusters, selectedDomain],
  );
  const lookerClusterCaseGroupedRegex = useMemo(
    () => buildLookerStudioClusterCaseGroupedRegex(parsedCustomClusters),
    [parsedCustomClusters],
  );
  const lookerClusterLevel1Case = useMemo(
    () => (selectedDomain ? buildLookerStudioClusterLevelCase(selectedDomain, parsedClusterLevelRules, 1) : ''),
    [parsedClusterLevelRules, selectedDomain],
  );
  const lookerClusterLevel2Case = useMemo(
    () => (selectedDomain ? buildLookerStudioClusterLevelCase(selectedDomain, parsedClusterLevelRules, 2) : ''),
    [parsedClusterLevelRules, selectedDomain],
  );
  const lookerClusterLevel1CaseGroupedRegex = useMemo(
    () => buildLookerStudioClusterLevelCaseGroupedRegex(parsedClusterLevelRules, 1),
    [parsedClusterLevelRules],
  );
  const lookerClusterLevel2CaseGroupedRegex = useMemo(
    () => buildLookerStudioClusterLevelCaseGroupedRegex(parsedClusterLevelRules, 2),
    [parsedClusterLevelRules],
  );
  const maxConfiguredRuleLevel = useMemo(
    () => parsedClusterLevelRules.reduce((max, rule) => Math.max(max, rule.levels.length), 0),
    [parsedClusterLevelRules],
  );
  const lookerClusterLevelGroupedCases = useMemo(() => {
    const totalLevels = Math.max(2, maxConfiguredRuleLevel);
    return Array.from({ length: totalLevels }, (_, index) => ({
      level: index + 1,
      expression: buildLookerStudioClusterLevelCaseGroupedRegex(parsedClusterLevelRules, index + 1),
    }));
  }, [maxConfiguredRuleLevel, parsedClusterLevelRules]);

  const lookerDepthCases = useMemo(() => {
    const safeDepth = Math.min(10, Math.max(1, Math.floor(clusterDepthLevels)));
    return Array.from({ length: safeDepth }, (_, index) => ({
      level: index + 1,
      expression: buildLookerStudioUrlLevelCase(index + 1),
    }));
  }, [clusterDepthLevels]);

  const saveCurrentClusterRuleset = () => {
    const name = clusterRulesetName.trim();
    if (!name) return;
    setClusterRulesets((prev) => {
      const next = prev.filter((item) => item.name !== name);
      next.push({ name, clusterRulesText, clusterLevelRulesText });
      return next.sort((a, b) => a.name.localeCompare(b.name));
    });
  };

  const loadClusterRuleset = (name: string) => {
    const selected = clusterRulesets.find((item) => item.name === name);
    if (!selected) return;
    setClusterRulesText(selected.clusterRulesText);
    setClusterLevelRulesText(selected.clusterLevelRulesText);
    setClusterRulesetName(selected.name);
  };

  const deleteClusterRuleset = (name: string) => {
    setClusterRulesets((prev) => prev.filter((item) => item.name !== name));
  };

  return {
    clusterRulesText,
    setClusterRulesText,
    clusterLevelRulesText,
    setClusterLevelRulesText,
    clusterRulesetName,
    setClusterRulesetName,
    clusterRulesets,
    lookerClusterCase,
    lookerClusterCaseGroupedRegex,
    lookerClusterLevel1Case,
    lookerClusterLevel2Case,
    lookerClusterLevel1CaseGroupedRegex,
    lookerClusterLevel2CaseGroupedRegex,
    lookerClusterLevelGroupedCases,
    lookerDepthCases,
    saveCurrentClusterRuleset,
    loadClusterRuleset,
    deleteClusterRuleset,
  };
};
