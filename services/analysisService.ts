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

export const performFullAnalysis = (variables: RandomVariable[], theoreticalModels: TheoreticalModel[]): AnalysisResults => {
    if (variables.length === 0 || variables[0]?.data.length === 0) {
        throw new Error("Cannot perform analysis on empty dataset.");
    }
    
    const numVars = variables.length;
    const varMap = new Map(variables.map((v, i) => [v.id, { ...v, index: i }]));
    const varNames = variables.map(v => v.name);

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
    
    // --- THEORETICAL & MODEL FIT ANALYSIS ---
    const modelFit: ModelFitResult[] = [];
    theoreticalModels.forEach(model => {
        const fitResult: ModelFitResult = { modelName: model.name };
        const modelPMFOrError = parseTheoreticalModel(model, varNames);
        if (typeof modelPMFOrError === 'string') {
            fitResult.error = modelPMFOrError;
            modelFit.push(fitResult);
            return;
        }
        const modelJointPMF = modelPMFOrError;
        
        fitResult.hellingerDistance = calculateHellingerDistance(empiricalJointPMF, modelJointPMF);
        fitResult.jensenShannonDistance = calculateJensenShannonDistance(empiricalJointPMF, modelJointPMF);
        
        // --- MSE CALCULATION ---
        // This section calculates the Mean Squared Error (MSE) to evaluate how well the theoretical model's
        // predictions for numerical variables match the empirical data.
        // The calculation strategy depends on whether categorical variables are present.
        fitResult.mse = {};
        
        // Pre-calculate all single-var theoretical metrics from the model for later use.
        variables.forEach((v, i) => {
            const modelMarginal = getMarginalPMF(modelJointPMF, [i], numVars);
            single_vars[v.id].theoretical[model.id] = getSingleVarMetrics(modelMarginal, v.type, v.ordinalOrder);
        });

        // Separate variables into numerical and categorical for targeted MSE calculations.
        const numericalVars = variables.filter(v => v.type === VariableType.Numerical);
        const categoricalVars = variables.filter(v => v.type === VariableType.Nominal || v.type === VariableType.Ordinal);

        // Case 1: The dataset contains both numerical and categorical variables.
        // We calculate a conditional MSE for each numerical variable, conditioned on each categorical variable.
        // This evaluates the model's ability to predict the numerical value given a category.
        if (numericalVars.length > 0 && categoricalVars.length > 0) {
            
            // Iterate through every possible pair of (numerical variable, categorical variable).
            numericalVars.forEach(numVar => {
                categoricalVars.forEach(catVar => {
                    const numVarIndex = variables.findIndex(v => v.id === numVar.id);
                    const catVarIndex = variables.findIndex(v => v.id === catVar.id);
                    
                    // To find the conditional mean E[Numerical | Categorical], we first need the model's joint distribution for this pair.
                    const modelPairPMF = getMarginalPMF(modelJointPMF, [numVarIndex, catVarIndex], numVars);
                    const modelMarginalNum = getMarginalPMF(modelJointPMF, [numVarIndex], numVars);
                    const modelMarginalCat = getMarginalPMF(modelJointPMF, [catVarIndex], numVars);
                    
                    // From the model's distributions, calculate all conditional distributions, including E[Numerical | Categorical=c] for each category c.
                    const modelConditionalDists = getConditionalDistributions(modelPairPMF, modelMarginalNum, modelMarginalCat, numVar, catVar);
                    
                    // Store the calculated conditional means from the model in a map for easy lookup.
                    // The key is the category value (e.g., 'high', 'red'), and the value is the expected mean of the numerical variable for that category.
                    const conditionalMeansByCatValue = new Map<string, number>();
                    const resultsForNumGivenCat = modelConditionalDists[catVar.name];
                    if (resultsForNumGivenCat) {
                        resultsForNumGivenCat.forEach(condResult => {
                            if (condResult.conditionalVariable === numVar.name && condResult.mean !== undefined) {
                                conditionalMeansByCatValue.set(condResult.conditionValue, condResult.mean);
                            }
                        });
                    }
                    
                    // Get all unique categories observed in the empirical data for the categorical variable.
                    const uniqueCategories = [...new Set(catVar.data)];
                    let cumulativeMse = 0;
                    // We need the empirical marginal probabilities of the categorical variable to weight the per-category MSEs.
                    const empiricalCatMarginal = empiricalMarginals[catVar.id];

                    // Now, for each unique category, calculate its specific MSE.
                    uniqueCategories.forEach(catValue => {
                        // Get the model's predicted mean for this specific category.
                        const modelConditionalMean = conditionalMeansByCatValue.get(catValue);
                        if (modelConditionalMean === undefined) return; // Skip if the model doesn't predict for this category.
                        
                        let sumSqErr = 0;
                        let count = 0;
                        // Iterate through the entire dataset to find matching observations.
                        for (let i = 0; i < numVar.data.length; i++) {
                            // Filter the data: only consider rows where the categorical variable matches the current category value.
                            if (catVar.data[i] === catValue) {
                                // For this subset of data, calculate the squared error against the model's conditional mean.
                                sumSqErr += Math.pow(Number(numVar.data[i]) - modelConditionalMean, 2);
                                count++;
                            }
                        }
                        
                        // If we found any data for this category, calculate the MSE for this group.
                        if (count > 0) {
                            // The MSE for this category is the average of the squared errors.
                            // MSE(Numerical | Categorical=c) = (1/N_c) * Σ( (y_i - E[Y|X=c])^2 )
                            const mse = sumSqErr / count;
                            const key = `MSE: ${numVar.name} | ${catVar.name}=${catValue}`;
                            fitResult.mse![key] = mse;

                            // To calculate the cumulative MSE, we weight this category's MSE by its empirical probability.
                            const weight = empiricalCatMarginal.get(catValue); // P(Categorical=c) from data.
                            if (weight !== undefined) {
                                // cumulativeMse = Σ [ P(Categorical=c) * MSE(Numerical | Categorical=c) ]
                                cumulativeMse += mse * weight;
                            }
                        }
                    });

                    // If a cumulative MSE was calculated, add it to the results.
                    if (cumulativeMse > 0) {
                         const cumulativeKey = `Cumulative MSE (${numVar.name} | ${catVar.name})`;
                         fitResult.mse![cumulativeKey] = cumulativeMse;
                    }
                });
            });
        } 
        // Case 2: The dataset only contains numerical variables (or no categorical ones).
        // The calculation is simpler: we compare the empirical data against the model's overall theoretical mean for each variable.
        else if (numericalVars.length > 0) {
            numericalVars.forEach(numVar => {
                // Get the theoretical mean for the numerical variable from the pre-calculated model metrics.
                const modelMean = single_vars[numVar.id]?.theoretical[model.id]?.mean;
                
                if (modelMean !== undefined) {
                    const data = numVar.data.map(Number);
                    // Calculate the sum of squared errors between each data point and the model's mean.
                    const sumSqErr = data.reduce((acc, val) => acc + Math.pow(val - modelMean, 2), 0);
                    // The MSE is the average of the squared errors.
                    // MSE = (1/N) * Σ( (y_i - E[Y])^2 )
                    const mse = sumSqErr / data.length;
                    fitResult.mse![`MSE: ${numVar.name}`] = mse;
                }
            });
        }

        // --- THEORETICAL PAIRWISE ---
        pairwise.forEach(pair => {
            const v1 = varMap.get(pair.var1_id)!;
            const v2 = varMap.get(pair.var2_id)!;
            const modelPairPMF = getMarginalPMF(modelJointPMF, [v1.index, v2.index], numVars);
            const modelMarginal1 = getMarginalPMF(modelJointPMF, [v1.index], numVars);
            const modelMarginal2 = getMarginalPMF(modelJointPMF, [v2.index], numVars);
            
            pair.theoretical[model.id] = {
                 mutualInformation: calculateMutualInformation(modelPairPMF, modelMarginal1, modelMarginal2),
            };

            const pairKey = [v1.id, v2.id].sort().join('-');
            if (conditional[pairKey]) {
                conditional[pairKey].theoretical[model.id] = getConditionalDistributions(modelPairPMF, modelMarginal1, modelMarginal2, v1, v2);
            }
        });

        modelFit.push(fitResult);
    });

    return { single_vars, pairwise, modelFit, conditional, empiricalJointPMF };
};