import {
    type TimeSeriesAnalysisResults,
    type TPM,
    type HellingerResult,
    type JointPMF
} from '../types';
// Fix: Import `calculateHellingerDistance` from `../utils/math` to resolve an undefined function call. This function is necessary for comparing the empirical joint probability mass function (PMF) with the Markovian approximation PMF.
import { calculateGeneralizedJensenShannonDivergence, calculateShannonEntropy, calculateHellingerDistance } from '../utils/math';
import { cartesianProduct } from '../utils/distribution';

const calculateTPM = (
    timeLabels: string[],
    instanceData: string[][],
    stateSpace: string[],
    timeIndex: number, // The index of the 'to' state
    order: number
): TPM => {
    const tpm: TPM = new Map();
    const fromStateCounts: Map<string, number> = new Map();
    const jointCounts: Map<string, Map<string, number>> = new Map();

    const numInstances = instanceData.length;
    
    if (timeIndex < order) return tpm; // Not enough history

    for (let i = 0; i < numInstances; i++) {
        const fromStateParts: string[] = [];
        for (let j = order; j > 0; j--) {
            fromStateParts.push(instanceData[i][timeIndex - j]);
        }
        const fromState = fromStateParts.join(',');
        const toState = instanceData[i][timeIndex];

        // Increment counts
        fromStateCounts.set(fromState, (fromStateCounts.get(fromState) || 0) + 1);
        if (!jointCounts.has(fromState)) {
            jointCounts.set(fromState, new Map());
        }
        const toCounts = jointCounts.get(fromState)!;
        toCounts.set(toState, (toCounts.get(toState) || 0) + 1);
    }
    
    // Calculate probabilities
    for (const [fromState, totalCount] of fromStateCounts.entries()) {
        if (totalCount > 0) {
            const toDist = new Map<string, number>();
            const toCounts = jointCounts.get(fromState)!;
            for (const toState of stateSpace) {
                const prob = (toCounts.get(toState) || 0) / totalCount;
                toDist.set(toState, prob);
            }
            tpm.set(fromState, toDist);
        }
    }
    return tpm;
};

const calculateHellingerDistanceTPM = (tpm1: TPM, tpm2: TPM): number => {
    const fromStates = new Set([...tpm1.keys(), ...tpm2.keys()]);
    const toStates = new Set<string>();
    for (const fromState of fromStates) {
        tpm1.get(fromState)?.forEach((_, toState) => toStates.add(toState));
        tpm2.get(fromState)?.forEach((_, toState) => toStates.add(toState));
    }
    const sortedFromStates = [...fromStates].sort();
    const sortedToStates = [...toStates].sort();

    if (sortedFromStates.length === 0 || sortedToStates.length === 0) return 0;

    const p: number[] = [];
    const q: number[] = [];
    for (const fromState of sortedFromStates) {
        for (const toState of sortedToStates) {
            p.push(tpm1.get(fromState)?.get(toState) || 0);
            q.push(tpm2.get(fromState)?.get(toState) || 0);
        }
    }

    let sumOfSquaredDiffs = 0;
    for (let i = 0; i < p.length; i++) {
        sumOfSquaredDiffs += Math.pow(Math.sqrt(p[i]) - Math.sqrt(q[i]), 2);
    }

    return (1 / Math.sqrt(2)) * Math.sqrt(sumOfSquaredDiffs);
};

const tpmToJointPmf = (tpm: TPM, allFromStates: string[], allToStates: string[]): JointPMF => {
    const pmf: JointPMF = new Map();
    let totalProb = 0;
    
    for(const fromState of allFromStates) {
        for(const toState of allToStates) {
            const prob = tpm.get(fromState)?.get(toState) || 0;
            if(prob > 0) {
                 pmf.set(`${fromState},${toState}`, prob);
                 totalProb += prob;
            }
        }
    }
    
    if (allFromStates.length > 0) {
        const numFromStates = allFromStates.length;
        for (const [key, prob] of pmf.entries()) {
            pmf.set(key, prob / numFromStates);
        }
    }
    
    return pmf;
};

const calculateGJS_TPM_Distance_normalized = (tpms: TPM[]): number => {
    const n = tpms.length;
    if (n < 2) return 0;

    const allFromStates = new Set<string>();
    const allToStates = new Set<string>();
    tpms.forEach(tpm => {
        tpm.forEach((dist, fromState) => {
            allFromStates.add(fromState);
            dist.forEach((_, toState) => allToStates.add(toState));
        });
    });
    const fromStateList = [...allFromStates].sort();
    const toStateList = [...allToStates].sort();
    
    const pmfs = tpms.map(tpm => tpmToJointPmf(tpm, fromStateList, toStateList));

    const divergence_bits = calculateGeneralizedJensenShannonDivergence(pmfs);
    const JSD_norm_divergence = divergence_bits / Math.log2(n);
    const clamped_divergence = Math.min(Math.max(JSD_norm_divergence, 0), 1);
    
    return Math.sqrt(clamped_divergence);
};

const runHomogeneityCheck = (tpms: {tpm: TPM, label: string}[]): { hellingerDistances: HellingerResult[], gjsDistance: number, isHomogeneous: boolean } => {
    if (tpms.length < 2) {
        return { hellingerDistances: [], gjsDistance: 0, isHomogeneous: true };
    }

    const hellingerDistances: HellingerResult[] = [];
    for (let i = 0; i < tpms.length; i++) {
        for (let j = i + 1; j < tpms.length; j++) {
            const dist = calculateHellingerDistanceTPM(tpms[i].tpm, tpms[j].tpm);
            hellingerDistances.push({ pair: `${tpms[i].label} vs ${tpms[j].label}`, distance: dist });
        }
    }

    const gjsDistance = calculateGJS_TPM_Distance_normalized(tpms.map(t => t.tpm));
    
    const isHomogeneous = hellingerDistances.every(r => r.distance <= 0.5) && gjsDistance <= 0.5;

    return { hellingerDistances, gjsDistance, isHomogeneous };
};

export const performTimeSeriesAnalysis = (text: string): TimeSeriesAnalysisResults => {
    const lines = text.trim().split('\n');
    const header = lines[0].split(',').map(h => h.trim());
    const dataRows = lines.slice(1);

    const timeLabels = dataRows.map(row => row.split(',')[0].trim());
    const instanceData: string[][] = [];
    const numInstances = header.length - 1;
    const numTimeSteps = timeLabels.length;

    for (let i = 0; i < numInstances; i++) {
        instanceData.push(dataRows.map(row => row.split(',')[i + 1].trim()));
    }
    const stateSpace = [...new Set(instanceData.flat())].sort();
    
    const tpms_firstOrder: { tpm: TPM; label: string }[] = [];
    for (let t = 1; t < numTimeSteps; t++) {
        tpms_firstOrder.push({
            tpm: calculateTPM(timeLabels, instanceData, stateSpace, t, 1),
            label: `P(${timeLabels[t]}|${timeLabels[t-1]})`
        });
    }
    
    const homogeneityCheck = runHomogeneityCheck(tpms_firstOrder);
    
    const allFromStates = new Set<string>();
    const allToStates = new Set<string>(stateSpace);
    tpms_firstOrder.forEach(({tpm}) => tpm.forEach((_, fromState) => allFromStates.add(fromState)));
    
    const average_tpm: TPM = new Map();
    for(const fromState of allFromStates) {
        const avgDist = new Map<string, number>();
        for (const toState of allToStates) {
            let sumProb = 0;
            tpms_firstOrder.forEach(({tpm}) => {
                sumProb += tpm.get(fromState)?.get(toState) || 0;
            });
            avgDist.set(toState, sumProb / tpms_firstOrder.length);
        }
        average_tpm.set(fromState, avgDist);
    }
    const average_tpm_firstOrder = { tpm: average_tpm, label: 'Average 1st Order TPM' };
    
    const fullHistoryPMF: JointPMF = new Map();
    for (let i = 0; i < numInstances; i++) {
        const sequence = instanceData[i].join(',');
        fullHistoryPMF.set(sequence, (fullHistoryPMF.get(sequence) || 0) + 1);
    }
    for (const [seq, count] of fullHistoryPMF.entries()) {
        fullHistoryPMF.set(seq, count / numInstances);
    }

    const representativeTPM = homogeneityCheck.isHomogeneous 
        ? (tpms_firstOrder[0]?.tpm || new Map())
        : average_tpm_firstOrder.tpm;

    const initialStatePMF: JointPMF = new Map();
    for(let i=0; i < numInstances; i++) {
        const initialState = instanceData[i][0];
        initialStatePMF.set(initialState, (initialStatePMF.get(initialState) || 0) + 1);
    }
    for(const [state, count] of initialStatePMF.entries()) {
        initialStatePMF.set(state, count / numInstances);
    }

    const markovApproximationPMF: JointPMF = new Map();
    
    const stateSpacesForTimesteps: string[][] = Array(numTimeSteps).fill(stateSpace);
    const allPossibleSequences = cartesianProduct(...stateSpacesForTimesteps);

    for (const states of allPossibleSequences) {
        if (states.length === 0) continue;
        
        let probability = initialStatePMF.get(states[0]) || 0;
        
        for (let t = 1; t < states.length; t++) {
            const fromState = states[t-1];
            const toState = states[t];
            const transitionProb = representativeTPM.get(fromState)?.get(toState) || 0;
            probability *= transitionProb;
        }
        const sequenceKey = states.join(',');
        markovApproximationPMF.set(sequenceKey, probability);
    }

    let totalProb = 0;
    for (const p of markovApproximationPMF.values()) {
        totalProb += p;
    }

    if (totalProb > 1e-9 && Math.abs(totalProb - 1.0) > 1e-5) {
        for (const [key, prob] of markovApproximationPMF.entries()) {
            markovApproximationPMF.set(key, prob / totalProb);
        }
    }

    const hellingerDistance = calculateHellingerDistance(fullHistoryPMF, markovApproximationPMF);
    const jensenShannonDistance = Math.sqrt(calculateGeneralizedJensenShannonDivergence([fullHistoryPMF, markovApproximationPMF]));

    const markovianFit = {
        fullHistoryPMF,
        markovApproximationPMF,
        initialStatePMF,
        hellingerDistance,
        jensenShannonDistance,
    };

    const tpm_fullHistory = {
        tpm: calculateTPM(timeLabels, instanceData, stateSpace, numTimeSteps - 1, numTimeSteps - 1),
        label: `P(${timeLabels[numTimeSteps-1]}|...${timeLabels[0]})`
    };

    const weakStationarity = {
        mean: [] as number[],
        variance: [] as number[],
        timeLabels: timeLabels,
    };
    for (let t = 0; t < numTimeSteps; t++) {
        const valuesAtTimeT = instanceData.map(instance => Number(instance[t])).filter(v => !isNaN(v));
        if (valuesAtTimeT.length > 0) {
            const mean = valuesAtTimeT.reduce((a, b) => a + b, 0) / valuesAtTimeT.length;
            const variance = valuesAtTimeT.length > 1 
                ? valuesAtTimeT.reduce((a, v) => a + Math.pow(v - mean, 2), 0) / (valuesAtTimeT.length - 1)
                : 0;
            weakStationarity.mean.push(mean);
            weakStationarity.variance.push(variance);
        } else {
            weakStationarity.mean.push(NaN);
            weakStationarity.variance.push(NaN);
        }
    }
    
    return {
        isHomogeneous: homogeneityCheck.isHomogeneous,
        homogeneityMetrics: { hellingerDistances: homogeneityCheck.hellingerDistances, gjsDistance: homogeneityCheck.gjsDistance },
        markovianFit,
        tpms_firstOrder,
        tpm_fullHistory,
        average_tpm_firstOrder,
        weakStationarity,
        stateSpace,
    };
};