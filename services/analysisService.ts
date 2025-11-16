import {
    type RandomVariable,
    type AnalysisResults,
    VariableType,
    type TheoreticalModel,
    type SingleVarResults,
    type PairwiseResult,
    type ModelFitResult,
    type JointPMF,
    type Distribution,
    type SingleVarMetrics,
    type PairwiseConditionalAnalysis,
    type ConditionalResult,
    type PairwiseMetrics,
    type TimeSeriesAnalysisResults,
    type TPM,
    type HellingerResult
} from '../types';

// --- UTILITY FUNCTIONS ---

/**
 * Calculates the mean of a numerical distribution.
 */
const calculateMean = (dist: Distribution): number => {
    return dist.reduce((acc, { value, probability }) => acc + Number(value) * probability, 0);
};

/**
 * Calculates the variance of a numerical distribution.
 */
const calculateVariance = (dist: Distribution, mean: number): number => {
    return dist.reduce((acc, { value, probability }) => acc + Math.pow(Number(value) - mean, 2) * probability, 0);
};

/**
 * Calculates the mode(s) of a distribution.
 */
const calculateMode = (dist: Distribution): (string | number)[] => {
    if (dist.length === 0) return [];
    const maxProb = Math.max(...dist.map(p => p.probability));
    // Use a small epsilon for floating point comparison
    return dist.filter(p => Math.abs(p.probability - maxProb) < 1e-9).map(p => p.value);
};

/**
 * Calculates the median of a distribution.
 */
const calculateMedian = (dist: Distribution, type: VariableType, ordinalOrder: string[]): string | number | undefined => {
    if (dist.length === 0) return undefined;
    
    let sortedDist = [...dist];
    if (type === VariableType.Numerical) {
        sortedDist.sort((a, b) => Number(a.value) - Number(b.value));
    } else if (type === VariableType.Ordinal && ordinalOrder.length > 0) {
        sortedDist.sort((a, b) => ordinalOrder.indexOf(String(a.value)) - ordinalOrder.indexOf(String(b.value)));
    }
    // For nominal, median is not well-defined, but we can return the first value past 0.5 cumulative for completeness.

    let cumulative = 0;
    for (const point of sortedDist) {
        cumulative += point.probability;
        if (cumulative >= 0.5) {
            return point.value;
        }
    }
    // Should not be reached if probabilities sum to 1, but as a fallback:
    return sortedDist[sortedDist.length - 1].value;
};


/**
 * Converts a PMF map to a Distribution array with cumulative probabilities.
 */
const pmfToDistribution = (pmf: JointPMF, type: VariableType, ordinalOrder: string[]): Distribution => {
    const dist: { value: string | number, probability: number }[] = Array.from(pmf.entries()).map(([value, probability]) => ({
        value: type === VariableType.Numerical ? Number(value) : value,
        probability,
    }));

    if (type === VariableType.Numerical) {
        dist.sort((a, b) => Number(a.value) - Number(b.value));
    } else if (type === VariableType.Ordinal && ordinalOrder.length > 0) {
        dist.sort((a, b) => ordinalOrder.indexOf(String(a.value)) - ordinalOrder.indexOf(String(b.value)));
    } else {
        // Sort by value for consistency if not numerical or ordered ordinal
        dist.sort((a, b) => String(a.value).localeCompare(String(a.value)));
    }
    
    let cumulative = 0;
    return dist.map(p => {
        cumulative += p.probability;
        return { ...p, cumulative };
    });
};

/**
 * Calculates single variable metrics from a PMF.
 */
const getSingleVarMetrics = (pmf: JointPMF, type: VariableType, ordinalOrder: string[]): SingleVarMetrics => {
    const distribution = pmfToDistribution(pmf, type, ordinalOrder);
    const metrics: SingleVarMetrics = {
        pmf: distribution,
        mode: calculateMode(distribution),
        median: calculateMedian(distribution, type, ordinalOrder),
    };

    if (type === VariableType.Numerical && distribution.every(p => !isNaN(Number(p.value)))) {
        metrics.mean = calculateMean(distribution);
        metrics.variance = calculateVariance(distribution, metrics.mean);
    }

    return metrics;
};


// --- CORE LOGIC FUNCTIONS ---

/**
 * Calculates the joint probability mass function from the raw data.
 */
const getEmpiricalJointPMF = (variables: RandomVariable[]): JointPMF => {
    const jointPMF: JointPMF = new Map();
    const numSamples = variables[0]?.data.length || 0;
    if (numSamples === 0) return jointPMF;

    for (let i = 0; i < numSamples; i++) {
        const outcome = variables.map(v => v.data[i]).join(',');
        jointPMF.set(outcome, (jointPMF.get(outcome) || 0) + 1);
    }

    for (const [outcome, count] of jointPMF.entries()) {
        jointPMF.set(outcome, count / numSamples);
    }

    return jointPMF;
};

/**
 * Marginalizes a joint PMF to get the PMF of a subset of variables.
 */
const getMarginalPMF = (jointPMF: JointPMF, varIndicesToKeep: number[], numTotalVars: number): JointPMF => {
    const marginalPMF: JointPMF = new Map();
    for (const [outcome, prob] of jointPMF.entries()) {
        const values = outcome.split(',');
        if (values.length !== numTotalVars) continue;
        const marginalKey = varIndicesToKeep.map(i => values[i]).join(',');
        marginalPMF.set(marginalKey, (marginalPMF.get(marginalKey) || 0) + prob);
    }
    return marginalPMF;
};

/**
 * Calculates Pearson correlation for two numerical variables.
 */
const calculatePearsonCorrelation = (data1: string[], data2: string[]): number => {
    const n = data1.length;
    const numData1 = data1.map(Number);
    const numData2 = data2.map(Number);
    
    const mean1 = numData1.reduce((a, b) => a + b, 0) / n;
    const mean2 = numData2.reduce((a, b) => a + b, 0) / n;
    
    const stdDev1 = Math.sqrt(numData1.map(x => Math.pow(x - mean1, 2)).reduce((a, b) => a + b, 0) / n);
    const stdDev2 = Math.sqrt(numData2.map(x => Math.pow(x - mean2, 2)).reduce((a, b) => a + b, 0) / n);
    
    if (stdDev1 === 0 || stdDev2 === 0) return 0;

    let cov = 0;
    for (let i = 0; i < n; i++) {
        cov += (numData1[i] - mean1) * (numData2[i] - mean2);
    }
    cov /= n;

    return cov / (stdDev1 * stdDev2);
};

/**
 * Calculates mutual information between two variables from their PMFs.
 */
const calculateMutualInformation = (jointPMF: JointPMF, marginal1: JointPMF, marginal2: JointPMF): number => {
    let mi = 0;
    for (const [jointKey, jointProb] of jointPMF.entries()) {
        const [key1, key2] = jointKey.split(',');
        const prob1 = marginal1.get(key1) || 0;
        const prob2 = marginal2.get(key2) || 0;
        if (jointProb > 1e-9 && prob1 > 1e-9 && prob2 > 1e-9) {
            mi += jointProb * Math.log2(jointProb / (prob1 * prob2));
        }
    }
    return mi;
};

/**
 * Calculates distance correlation.
 */
 const calculateDistanceCorrelation = (data1: string[], data2: string[]): number => {
    const n = data1.length;
    if (n < 2) return 0;

    const isNumeric1 = detectVariableType(data1) === VariableType.Numerical;
    const isNumeric2 = detectVariableType(data2) === VariableType.Numerical;

    const dist = (a: string, b: string, isNumeric: boolean) => isNumeric ? Math.abs(Number(a) - Number(b)) : (a === b ? 0 : 1);
    
    const a = Array.from({ length: n }, () => Array(n).fill(0));
    const b = Array.from({ length: n }, () => Array(n).fill(0));

    for (let i = 0; i < n; i++) {
        for (let j = i; j < n; j++) {
            a[i][j] = a[j][i] = dist(data1[i], data1[j], isNumeric1);
            b[i][j] = b[j][i] = dist(data2[i], data2[j], isNumeric2);
        }
    }

    const doubleCenter = (matrix: number[][]): number[][] => {
        const centered = Array.from({ length: n }, () => Array(n).fill(0));
        const rowMeans = matrix.map(row => row.reduce((s, v) => s + v, 0) / n);
        const colMeans = rowMeans; // symmetric
        const totalMean = rowMeans.reduce((s, v) => s + v, 0) / n;
        for (let i = 0; i < n; i++) {
            for (let j = 0; j < n; j++) {
                centered[i][j] = matrix[i][j] - rowMeans[i] - colMeans[j] + totalMean;
            }
        }
        return centered;
    };
    
    const A = doubleCenter(a);
    const B = doubleCenter(b);
    
    let dCov2 = 0, dVar1_2 = 0, dVar2_2 = 0;
    for (let i = 0; i < n; i++) {
        for (let j = 0; j < n; j++) {
            dCov2 += A[i][j] * B[i][j];
            dVar1_2 += A[i][j] * A[i][j];
            dVar2_2 += B[i][j] * B[i][j];
        }
    }
    
    dCov2 /= (n * n);
    dVar1_2 /= (n * n);
    dVar2_2 /= (n * n);
    
    if (dVar1_2 <= 1e-9 || dVar2_2 <= 1e-9) return 0;

    return Math.sqrt(Math.max(0, dCov2 / Math.sqrt(dVar1_2 * dVar2_2)));
};

/**
 * Calculates conditional distributions for a pair of variables.
 */
const getConditionalDistributions = (
    jointPMF: JointPMF,
    marginal1: JointPMF,
    marginal2: JointPMF,
    var1: RandomVariable,
    var2: RandomVariable
): { [givenVarName: string]: ConditionalResult[] } => {
    const results: { [givenVarName: string]: ConditionalResult[] } = {
        [var1.name]: [],
        [var2.name]: [],
    };
    const var1IsNumeric = var1.type === VariableType.Numerical;
    const var2IsNumeric = var2.type === VariableType.Numerical;

    // P(var1 | var2)
    for (const [val2, prob2] of marginal2.entries()) {
        if(prob2 < 1e-9) continue;
        const conditionalDist: { value: string, probability: number }[] = [];
        for (const [val1] of marginal1.entries()) {
            const jointProb = jointPMF.get(`${val1},${val2}`) || 0;
            conditionalDist.push({ value: val1, probability: jointProb / prob2 });
        }
        
        const dist = pmfToDistribution(new Map(conditionalDist.map(i => [i.value, i.probability])), var1.type, var1.ordinalOrder);
        const result: ConditionalResult = { conditionalVariable: var1.name, givenVariable: var2.name, conditionValue: val2, distribution: dist };
        if (var1IsNumeric) {
            result.mean = calculateMean(dist);
            result.variance = calculateVariance(dist, result.mean);
        }
        results[var2.name].push(result);
    }
    
    // P(var2 | var1)
    for (const [val1, prob1] of marginal1.entries()) {
         if(prob1 < 1e-9) continue;
        const conditionalDist: { value: string, probability: number }[] = [];
        for (const [val2] of marginal2.entries()) {
            const jointProb = jointPMF.get(`${val1},${val2}`) || 0;
            conditionalDist.push({ value: val2, probability: jointProb / prob1 });
        }

        const dist = pmfToDistribution(new Map(conditionalDist.map(i => [i.value, i.probability])), var2.type, var2.ordinalOrder);
        const result: ConditionalResult = { conditionalVariable: var2.name, givenVariable: var1.name, conditionValue: val1, distribution: dist };
        if (var2IsNumeric) {
            result.mean = calculateMean(dist);
            result.variance = calculateVariance(dist, result.mean);
        }
        results[var1.name].push(result);
    }
    
    return results;
};

/**
 * Parses a theoretical model's distribution string into a JointPMF.
 */
const parseTheoreticalModel = (model: TheoreticalModel, varNamesInOrder: string[]): JointPMF | string => {
    const lines = model.distribution.trim().split('\n');
    if (lines.length < 2) return "Model distribution is empty or invalid.";

    const header = lines[0].split(',').map(h => h.trim());
    const probIndex = header.indexOf('Probability');
    if (probIndex === -1) return "Model distribution must have a 'Probability' column.";
    
    const modelVarNames = header.slice(0, probIndex);
    if(JSON.stringify(modelVarNames) !== JSON.stringify(varNamesInOrder)) {
        return `Model variable order (${modelVarNames.join(',')}) does not match data order (${varNamesInOrder.join(',')}).`;
    }

    const jointPMF: JointPMF = new Map();
    let totalProb = 0;

    for (let i = 1; i < lines.length; i++) {
        const values = lines[i].split(',');
        if (values.length !== header.length) continue;
        const prob = parseFloat(values[probIndex]);
        if (isNaN(prob) || prob < 0) return `Invalid probability in row ${i + 1}: ${values[probIndex]}`;
        
        const key = values.slice(0, probIndex).join(',');
        jointPMF.set(key, (jointPMF.get(key) || 0) + prob);
        totalProb += prob;
    }

    if (Math.abs(totalProb - 1.0) > 1e-5) {
       // This is handled in the UI, but could be a warning here.
    }
    
    return jointPMF;
};

const klDivergence = (p: JointPMF, q: JointPMF): number => {
    let divergence = 0;
    const allKeys = new Set([...p.keys()]);
    for (const key of allKeys) {
        const pVal = p.get(key) || 0;
        const qVal = q.get(key) || 0;
        if (pVal > 1e-9 && qVal > 1e-9) {
            divergence += pVal * Math.log2(pVal / qVal);
        }
    }
    return divergence;
};

const calculateHellingerDistance = (pmf1: JointPMF, pmf2: JointPMF): number => {
    const allKeys = new Set([...pmf1.keys(), ...pmf2.keys()]);
    let sum = 0;
    for (const key of allKeys) {
        const p1 = pmf1.get(key) || 0;
        const p2 = pmf2.get(key) || 0;
        sum += Math.pow(Math.sqrt(p1) - Math.sqrt(p2), 2);
    }
    return Math.sqrt(sum) / Math.sqrt(2);
};

const calculateJensenShannonDistance = (pmf1: JointPMF, pmf2: JointPMF): number => {
    const m = new Map<string, number>();
    const allKeys = new Set([...pmf1.keys(), ...pmf2.keys()]);
    for(const key of allKeys) {
        m.set(key, ((pmf1.get(key) || 0) + (pmf2.get(key) || 0)) / 2);
    }
    return Math.sqrt(0.5 * klDivergence(pmf1, m) + 0.5 * klDivergence(pmf2, m));
};


// --- EXPORTED API ---

export const parseInput = (text: string): { name: string; data: string[] }[] => {
    const lines = text.trim().split('\n').filter(line => line.trim() !== '');
    if (lines.length < 2) return [];

    const header = lines[0].split(',').map(h => h.trim());
    const dataRows = lines.slice(1);

    const variables: { name: string; data: string[] }[] = header.map(name => ({ name, data: [] }));

    dataRows.forEach(row => {
        const values = row.split(',').map(v => v.trim());
        if (values.length === header.length) {
            values.forEach((value, index) => {
                if (variables[index]) variables[index].data.push(value);
            });
        }
    });

    return variables.filter(v => v.name);
};


export const detectVariableType = (data: string[]): VariableType => {
    if (data.every(d => d === '' || !isNaN(Number(d)))) {
        return VariableType.Numerical;
    }
    return VariableType.Nominal;
};

const replacer = (key: any, value: any) => {
    if (value instanceof Map) return { dataType: 'Map', value: Array.from(value.entries()) };
    return value;
};

export const exportToJson = (results: AnalysisResults): string => {
    return JSON.stringify(results, replacer, 2);
};

const formatCsvValue = (val: any): string => {
    if (val === undefined || val === null) return 'N/A';
    if (Array.isArray(val)) return `"${val.join('; ')}"`;
    const str = String(val);
    if (str.includes(',')) return `"${str}"`;
    return str;
};

export const exportToCsv = (results: AnalysisResults, variables: RandomVariable[]): string => {
    let csv = '';

    // Single Variable Analysis
    csv += 'Single Variable Analysis\n';
    const firstVar = variables[0];
    if (firstVar && results.single_vars[firstVar.id]) {
        const modelNames = Object.keys(results.single_vars[firstVar.id].theoretical || {});
        
        variables.forEach(v => {
            const res = results.single_vars[v.id];
            if (!res) return;
            csv += `\nVariable,"${v.name}"\n`;
            csv += `Metric,Empirical,${modelNames.map(formatCsvValue).join(',')}\n`;
            
            const metrics: (keyof SingleVarMetrics)[] = ['mean', 'variance', 'median', 'mode'];
            metrics.forEach(metric => {
                const empiricalValue = res.empirical[metric];
                if (empiricalValue !== undefined && (!Array.isArray(empiricalValue) || empiricalValue.length > 0)) {
                    let row = `${metric},${formatCsvValue(empiricalValue)},`;
                    row += modelNames.map(modelId => formatCsvValue(res.theoretical[modelId]?.[metric])).join(',') + '\n';
                    csv += row;
                }
            });

            csv += '\nPMF (Empirical)\nValue,Probability\n';
            res.empirical.pmf.forEach(p => { csv += `${formatCsvValue(p.value)},${formatCsvValue(p.probability)}\n`; });

            modelNames.forEach(modelId => {
                csv += `\nPMF (${modelId})\nValue,Probability\n`;
                (res.theoretical[modelId]?.pmf || []).forEach(p => { csv += `${formatCsvValue(p.value)},${formatCsvValue(p.probability)}\n`; });
            });
        });
    }

    // Pairwise Analysis
    if (results.pairwise.length > 0) {
        csv += '\nPairwise Dependence Analysis\n';
        const firstPair = results.pairwise[0];
        const modelNames = Object.keys(firstPair.theoretical);
        csv += `Variable 1,Variable 2,Metric,Empirical,${modelNames.map(formatCsvValue).join(',')}\n`;

        const pairwiseMetrics: (keyof PairwiseMetrics)[] = ['distanceCorrelation', 'pearsonCorrelation', 'mutualInformation'];
        results.pairwise.forEach(pair => {
            pairwiseMetrics.forEach(metric => {
                if (pair.empirical[metric] !== undefined) {
                    let row = `${pair.var1_name},${pair.var2_name},${metric},${formatCsvValue(pair.empirical[metric])},`;
                    row += modelNames.map(modelId => formatCsvValue(pair.theoretical[modelId]?.[metric])).join(',') + '\n';
                    csv += row;
                }
            });
        });
    }

    // Model Fit
    if (results.modelFit.length > 0) {
        csv += '\nModel Fit Analysis\n';
        csv += 'Model,Metric,Value\n';
        results.modelFit.forEach(fit => {
            if (fit.error) {
                csv += `${formatCsvValue(fit.modelName)},error,${formatCsvValue(fit.error)}\n`;
            } else {
                if (fit.hellingerDistance !== undefined) csv += `${formatCsvValue(fit.modelName)},Hellinger Distance,${formatCsvValue(fit.hellingerDistance)}\n`;
                if (fit.jensenShannonDistance !== undefined) csv += `${formatCsvValue(fit.modelName)},Jensen-Shannon Distance,${formatCsvValue(fit.jensenShannonDistance)}\n`;
                if (fit.mse) {
                    Object.entries(fit.mse).forEach(([varName, mse]) => {
                        csv += `${formatCsvValue(fit.modelName)},MSE (${varName}),${formatCsvValue(mse)}\n`;
                    });
                }
            }
        });
    }

    return csv;
};

export const performFullAnalysis = (inputText: string): AnalysisResults => {
    const parsedData = parseInput(inputText);
    if (parsedData.length === 0 || parsedData[0].data.length === 0) {
        throw new Error("No data found. Please ensure the input has a header and data rows.");
    }
     const variables: RandomVariable[] = parsedData.map((v, i) => ({
        id: `var-${i}-${Date.now()}`,
        name: v.name,
        data: v.data,
        type: detectVariableType(v.data),
        ordinalOrder: [],
    }));

    if (variables.length === 0 || variables[0]?.data.length === 0) {
        throw new Error("Cannot perform analysis on empty dataset.");
    }
    
    const numVars = variables.length;
    const varMap = new Map(variables.map((v, i) => [v.id, { ...v, index: i }]));

    // --- EMPIRICAL ANALYSIS ---
    const empiricalJointPMF = getEmpiricalJointPMF(variables);
    const single_vars: { [variableId: string]: SingleVarResults } = {};
    const empiricalMarginals: { [variableId: string]: JointPMF } = {};

    variables.forEach((v, i) => {
        const pmf = getMarginalPMF(empiricalJointPMF, [i], numVars);
        empiricalMarginals[v.id] = pmf;
        single_vars[v.id] = {
            empirical: getSingleVarMetrics(pmf, v.type, v.ordinalOrder),
            theoretical: {},
        };
    });

    const pairwise: PairwiseResult[] = [];
    const conditional: { [pairKey: string]: PairwiseConditionalAnalysis } = {};

    for (let i = 0; i < numVars; i++) {
        for (let j = i + 1; j < numVars; j++) {
            const var1 = variables[i];
            const var2 = variables[j];
            
            const jointPMF = getMarginalPMF(empiricalJointPMF, [i, j], numVars);
            const marginal1 = empiricalMarginals[var1.id];
            const marginal2 = empiricalMarginals[var2.id];

            pairwise.push({
                var1_id: var1.id, var1_name: var1.name, var2_id: var2.id, var2_name: var2.name,
                empirical: {
                    distanceCorrelation: calculateDistanceCorrelation(var1.data, var2.data),
                    mutualInformation: calculateMutualInformation(jointPMF, marginal1, marginal2),
                    pearsonCorrelation: (var1.type === VariableType.Numerical && var2.type === VariableType.Numerical) ? calculatePearsonCorrelation(var1.data, var2.data) : undefined,
                },
                theoretical: {},
            });

            const pairKey = [var1.id, var2.id].sort().join('-');
            conditional[pairKey] = {
                empirical: getConditionalDistributions(jointPMF, marginal1, marginal2, var1, var2),
                theoretical: {}
            };
        }
    }
    
    // --- THEORETICAL & MODEL FIT ANALYSIS (Placeholder, as models are UI-driven) ---
    const modelFit: ModelFitResult[] = [];
    
    return { variables, single_vars, pairwise, modelFit, conditional, empiricalJointPMF };
};


// --- TIME SERIES ANALYSIS ---

/**
 * Checks if the input data format matches the time-series criteria.
 * Criteria: First column is 'Time', subsequent columns are 'Instance1', 'Instance2', etc. (case-insensitive).
 */
export const detectAnalysisType = (text: string): 'time-series' | 'cross-sectional' => {
    const lines = text.trim().split('\n');
    if (lines.length < 2) return 'cross-sectional';

    const header = lines[0].split(',').map(h => h.trim().toLowerCase());
    if (header.length < 2) return 'cross-sectional';

    if (header[0] !== 'time') return 'cross-sectional';

    for (let i = 1; i < header.length; i++) {
        if (header[i] !== `instance${i}`) {
            return 'cross-sectional';
        }
    }

    return 'time-series';
};

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
    const numTimeSteps = timeLabels.length;
    
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
    if (fromStates.size === 0) return 0;
    
    let totalSquaredHellinger = 0;
    
    for (const fromState of fromStates) {
        const dist1 = tpm1.get(fromState);
        const dist2 = tpm2.get(fromState);
        
        const toStates = new Set([...(dist1?.keys() || []), ...(dist2?.keys() || [])]);
        let sum = 0;
        
        for (const toState of toStates) {
            const p1 = dist1?.get(toState) || 0;
            const p2 = dist2?.get(toState) || 0;
            sum += Math.pow(Math.sqrt(p1) - Math.sqrt(p2), 2);
        }
        
        const h_dist_squared = sum / 2;
        totalSquaredHellinger += h_dist_squared;
    }
    
    // Assumes uniform probability over from_states for weighting.
    return Math.sqrt(totalSquaredHellinger / fromStates.size);
};

const calculateEntropy = (dist: Map<string, number>, base: number): number => {
    let entropy = 0;
    for (const prob of dist.values()) {
        if (prob > 1e-9) {
            entropy -= prob * (Math.log(prob) / Math.log(base));
        }
    }
    return entropy;
};

const calculateTPMEntropy = (tpm: TPM, base: number): number => {
    if (tpm.size === 0) return 0;
    let totalEntropy = 0;
    for (const fromState of tpm.keys()) {
        const dist = tpm.get(fromState)!;
        totalEntropy += calculateEntropy(dist, base);
    }
    // Average entropy across all from_states (assumes uniform stationary dist).
    return totalEntropy / tpm.size;
};

const calculateGJS_TPM = (tpms: TPM[]): number => {
    if (tpms.length < 2) return 0;
    const base = tpms.length;

    // 1. Calculate weighted average of TPMs
    const avgTpm: TPM = new Map();
    const allFromStates = new Set<string>();
    const allToStates = new Set<string>();
    tpms.forEach(tpm => {
        tpm.forEach((dist, fromState) => {
            allFromStates.add(fromState);
            dist.forEach((_, toState) => allToStates.add(toState));
        });
    });

    for (const fromState of allFromStates) {
        const avgDist = new Map<string, number>();
        for (const toState of allToStates) {
            let sumProb = 0;
            tpms.forEach(tpm => {
                sumProb += tpm.get(fromState)?.get(toState) || 0;
            });
            avgDist.set(toState, sumProb / tpms.length);
        }
        avgTpm.set(fromState, avgDist);
    }

    // 2. Calculate H(avg_tpm)
    const entropyOfAvg = calculateTPMEntropy(avgTpm, base);
    
    // 3. Calculate avg(H(tpm))
    let sumOfEntropies = 0;
    tpms.forEach(tpm => {
        sumOfEntropies += calculateTPMEntropy(tpm, base);
    });
    const avgOfEntropies = sumOfEntropies / tpms.length;

    return entropyOfAvg - avgOfEntropies;
};

const runHomogeneityCheck = (tpms: {tpm: TPM, label: string}[]): { hellingerDistances: HellingerResult[], gjsDivergence: number, isHomogeneous: boolean } => {
    if (tpms.length < 2) {
        return { hellingerDistances: [], gjsDivergence: 0, isHomogeneous: true };
    }

    const hellingerDistances: HellingerResult[] = [];
    for (let i = 0; i < tpms.length; i++) {
        for (let j = i + 1; j < tpms.length; j++) {
            const dist = calculateHellingerDistanceTPM(tpms[i].tpm, tpms[j].tpm);
            hellingerDistances.push({ pair: `${tpms[i].label} vs ${tpms[j].label}`, distance: dist });
        }
    }

    const gjsDivergence = calculateGJS_TPM(tpms.map(t => t.tpm));
    
    const isHomogeneous = hellingerDistances.every(r => r.distance <= 0.5) && gjsDivergence <= 0.5;

    return { hellingerDistances, gjsDivergence, isHomogeneous };
};


export const performTimeSeriesAnalysis = (text: string): TimeSeriesAnalysisResults => {
    const lines = text.trim().split('\n');
    const header = lines[0].split(',').map(h => h.trim());
    const dataRows = lines.slice(1);

    const timeLabels = dataRows.map(row => row.split(',')[0].trim());
    const instanceData: string[][] = []; // numInstances x numTimeSteps
    const numInstances = header.length - 1;
    const numTimeSteps = timeLabels.length;

    for (let i = 0; i < numInstances; i++) {
        instanceData.push(dataRows.map(row => row.split(',')[i + 1].trim()));
    }

    const stateSpace = [...new Set(instanceData.flat())].sort();

    // 1. Calculate all 1st-order TPMs: P(D_t | D_{t-1})
    const tpms_firstOrder: { tpm: TPM; label: string }[] = [];
    for (let t = 1; t < numTimeSteps; t++) {
        tpms_firstOrder.push({
            tpm: calculateTPM(timeLabels, instanceData, stateSpace, t, 1),
            label: `P(${timeLabels[t]}|${timeLabels[t-1]})`
        });
    }
    
    // 2. Check for Time Homogeneity on 1st-order TPMs
    const homogeneityCheck = runHomogeneityCheck(tpms_firstOrder);

    // 3. Calculate all 2nd-order TPMs: P(D_t | D_{t-1}, D_{t-2})
    const tpms_secondOrder: { tpm: TPM; label: string }[] = [];
     for (let t = 2; t < numTimeSteps; t++) {
        tpms_secondOrder.push({
            tpm: calculateTPM(timeLabels, instanceData, stateSpace, t, 2),
            label: `P(${timeLabels[t]}|${timeLabels[t-1]},${timeLabels[t-2]})`
        });
    }

    // 4. Check for Markov property (as homogeneity of 2nd-order TPMs)
    const markovianCheck = runHomogeneityCheck(tpms_secondOrder);

    // 5. Calculate Full History TPM: P(D_n | D_{n-1}, ..., D_1)
    const tpm_fullHistory = {
        tpm: calculateTPM(timeLabels, instanceData, stateSpace, numTimeSteps - 1, numTimeSteps - 1),
        label: `P(${timeLabels[numTimeSteps-1]}|...${timeLabels[0]})`
    };

    // 6. Calculate Average 1st-order TPM
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

    // 7. Weak Stationarity Analysis (Mean and Variance over time)
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
        homogeneityMetrics: { hellingerDistances: homogeneityCheck.hellingerDistances, gjsDivergence: homogeneityCheck.gjsDivergence },
        isMarkovian: markovianCheck.isHomogeneous,
        markovianMetrics: { hellingerDistances: markovianCheck.hellingerDistances, gjsDivergence: markovianCheck.gjsDivergence },
        tpms_firstOrder,
        tpm_fullHistory,
        average_tpm_firstOrder,
        weakStationarity,
        stateSpace,
    };
};
