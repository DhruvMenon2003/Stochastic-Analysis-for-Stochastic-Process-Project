
// FIX: Updated imports to correctly reference the new types.ts and include JointPMF.
import { type RandomVariable, VariableType, type AnalysisResults, type SingleVarResults, type PairwiseResult, type Distribution, type TheoreticalModel, type ModelFitResult, type SingleVarMetrics, type PairwiseConditionalAnalysis, type ConditionalResult, type JointPMF, PairwiseMetrics } from '../types';

// --- UTILITY & PARSING ---

export const parseInput = (text: string): { name: string, data: string[] }[] => {
    const lines = text.trim().split('\n').filter(line => line.trim() !== '');
    if (lines.length < 2) {
        throw new Error("Input must have a header line and at least one data row.");
    }

    const header = lines[0].split(',').map(h => h.trim());
    if (header.some(h => h === '')) {
        throw new Error("Header cannot contain empty variable names.");
    }
    const numVars = header.length;

    const dataRows = lines.slice(1);
    const columns: string[][] = Array(numVars).fill(0).map(() => []);

    dataRows.forEach((line, rowIndex) => {
        const values = line.split(',').map(v => v.trim());
        if (values.length !== numVars) {
            throw new Error(`Row ${rowIndex + 1} has ${values.length} values, but header has ${numVars} variables.`);
        }
        if (values.some(v => v === '')) {
            throw new Error(`Row ${rowIndex + 1} ("${line.substring(0, 30)}...") contains missing values. Please ensure all values are filled.`);
        }

        values.forEach((value, colIndex) => {
            columns[colIndex].push(value);
        });
    });

    return header.map((name, index) => ({
        name,
        data: columns[index],
    }));
};


export const detectVariableType = (data: string[]): VariableType => {
    const isNumeric = data.every(d => !isNaN(parseFloat(d)) && isFinite(Number(d)));
    if (isNumeric) return VariableType.Numerical;
    return VariableType.Nominal;
};

// --- SINGLE VARIABLE CALCULATIONS ---

type MarginalPMF = Map<string | number, number>;

const calculatePMF = (data: (string | number)[]): MarginalPMF => {
    const counts = new Map<string | number, number>();
    data.forEach(val => {
        counts.set(val, (counts.get(val) || 0) + 1);
    });
    const total = data.length;
    const pmf: MarginalPMF = new Map<string | number, number>();
    counts.forEach((count, val) => {
        pmf.set(val, count / total);
    });
    return pmf;
};

const getDistributionFromPMF = (pmf: MarginalPMF, type: VariableType, order: string[]): Distribution => {
    let sortedKeys: (string|number)[];
    const numericKeys = Array.from(pmf.keys()).every(k => typeof k === 'number' || !isNaN(Number(k)));

    if (type === VariableType.Numerical && numericKeys) {
        sortedKeys = Array.from(pmf.keys()).map(Number).sort((a, b) => a - b);
    } else if (type === VariableType.Ordinal && order.length > 0) {
        sortedKeys = order;
    } else {
        sortedKeys = Array.from(pmf.keys()).sort();
    }
    
    let cumulative = 0;
    const distribution: Distribution = [];

    sortedKeys.forEach(key => {
        const prob = pmf.get(key) || pmf.get(String(key)) || 0;
        if (prob > 0) {
            cumulative += prob;
            distribution.push({
                value: key,
                probability: prob,
                cumulative: cumulative
            });
        }
    });
    
    return distribution;
}


const calculateMeanFromPMF = (pmf: MarginalPMF): number => {
    let mean = 0;
    pmf.forEach((prob, val) => {
        mean += Number(val) * prob;
    });
    return mean;
};

const calculateVarianceFromPMF = (pmf: MarginalPMF, mean: number): number => {
    let variance = 0;
    pmf.forEach((prob, val) => {
        variance += Math.pow(Number(val) - mean, 2) * prob;
    });
    return variance;
};

const calculateModeFromPMF = (pmf: MarginalPMF): (string | number)[] => {
    let maxProb = 0;
    pmf.forEach(prob => {
        if (prob > maxProb) maxProb = prob;
    });
    if (maxProb <= 0) return [];
    
    const modes: (string | number)[] = [];
    pmf.forEach((prob, val) => {
        if (Math.abs(prob - maxProb) < 1e-9) modes.push(val);
    });
    // Check if all values are equally likely (uniform)
    if (modes.length === pmf.size && pmf.size > 1) return [];
    return modes;
};

const calculateMedianFromDistribution = (dist: Distribution): string | number => {
    const medianEntry = dist.find(d => d.cumulative >= 0.5);
    return medianEntry ? medianEntry.value : dist[dist.length - 1]?.value;
};

const calculateMetricsFromPMF = (pmf: MarginalPMF, variable: RandomVariable): SingleVarMetrics => {
    const metrics: SingleVarMetrics = { pmf: [] };
    const numericData = variable.type === VariableType.Numerical;

    metrics.pmf = getDistributionFromPMF(pmf, variable.type, variable.ordinalOrder);

    if (numericData) {
        const mean = calculateMeanFromPMF(pmf);
        metrics.mean = mean;
        metrics.variance = calculateVarianceFromPMF(pmf, mean);
    }
    if (variable.type === VariableType.Nominal || variable.type === VariableType.Ordinal) {
        metrics.mode = calculateModeFromPMF(pmf);
    }
    if (variable.type === VariableType.Ordinal && variable.ordinalOrder.length > 0) {
        metrics.median = calculateMedianFromDistribution(metrics.pmf);
    }
    return metrics;
};


// --- PAIRWISE DEPENDENCE CALCULATIONS ---
const calculateMean = (data: number[]): number => data.reduce((s, v) => s + v, 0) / data.length;
const calculateVariance = (data: number[], mean: number): number => data.reduce((s, v) => s + Math.pow(v - mean, 2), 0) / data.length;

const calculatePearsonCorrelation = (data1: number[], data2: number[]): number => {
    if (data1.length !== data2.length) throw new Error("Data lengths must match for Pearson correlation.");
    const n = data1.length;
    const mean1 = calculateMean(data1);
    const mean2 = calculateMean(data2);
    const stdDev1 = Math.sqrt(calculateVariance(data1, mean1));
    const stdDev2 = Math.sqrt(calculateVariance(data2, mean2));
    if (stdDev1 === 0 || stdDev2 === 0) return NaN;
    let covariance = 0;
    for (let i = 0; i < n; i++) covariance += (data1[i] - mean1) * (data2[i] - mean2);
    return (covariance / n) / (stdDev1 * stdDev2);
};

const calculateMutualInformation = (data1: (string | number)[], data2: (string | number)[]): number => {
    if (data1.length !== data2.length) throw new Error("Data lengths must match.");
    const n = data1.length;
    const p1 = calculatePMF(data1);
    const p2 = calculatePMF(data2);
    const jointCounts = new Map<string, number>();
    for (let i = 0; i < n; i++) {
        const key = `${data1[i]}__${data2[i]}`;
        jointCounts.set(key, (jointCounts.get(key) || 0) + 1);
    }
    let mi = 0;
    jointCounts.forEach((count, key) => {
        const [val1, val2] = key.split('__');
        const p_xy = count / n;
        const p_x = p1.get(val1) || p1.get(Number(val1)) || 0;
        const p_y = p2.get(val2) || p2.get(Number(val2)) || 0;
        if (p_x > 0 && p_y > 0 && p_xy > 0) mi += p_xy * Math.log2(p_xy / (p_x * p_y));
    });
    return mi;
};

const getDistanceMatrix = (data: (string | number)[], isNumeric: boolean) => {
    const n = data.length;
    const matrix = Array(n).fill(0).map(() => Array(n).fill(0));
    for (let i = 0; i < n; i++) {
        for (let j = i; j < n; j++) {
            let dist: number = isNumeric ? Math.abs(Number(data[i]) - Number(data[j])) : (data[i] === data[j] ? 0 : 1);
            matrix[i][j] = dist;
            matrix[j][i] = dist;
        }
    }
    return matrix;
};

const doubleCenterMatrix = (matrix: number[][]) => {
    const n = matrix.length;
    const rowMeans = matrix.map(row => row.reduce((a, b) => a + b, 0) / n);
    const colMeans = Array(n).fill(0).map((_, j) => matrix.reduce((sum, row) => sum + row[j], 0) / n);
    const totalMean = rowMeans.reduce((a, b) => a + b, 0) / n;
    const centered = Array(n).fill(0).map(() => Array(n).fill(0));
    for (let i = 0; i < n; i++) {
        for (let j = 0; j < n; j++) {
            centered[i][j] = matrix[i][j] - rowMeans[i] - colMeans[j] + totalMean;
        }
    }
    return centered;
};


const calculateDistanceCorrelation = (data1: (string | number)[], isNumeric1: boolean, data2: (string | number)[], isNumeric2: boolean): number => {
    if (data1.length !== data2.length) throw new Error("Data lengths must match.");
    const n = data1.length;
    if (n === 0) return NaN;
    const centeredA = doubleCenterMatrix(getDistanceMatrix(data1, isNumeric1));
    const centeredB = doubleCenterMatrix(getDistanceMatrix(data2, isNumeric2));
    let dCov2 = 0, dVarA2 = 0, dVarB2 = 0;
    for (let i = 0; i < n; i++) {
        for (let j = 0; j < n; j++) {
            dCov2 += centeredA[i][j] * centeredB[i][j];
            dVarA2 += centeredA[i][j] * centeredA[i][j];
            dVarB2 += centeredB[i][j] * centeredB[i][j];
        }
    }
    dCov2 /= (n * n);
    dVarA2 /= (n * n);
    dVarB2 /= (n * n);
    if (dVarA2 <= 0 || dVarB2 <= 0) return 0;
    return Math.sqrt(dCov2 / Math.sqrt(dVarA2 * dVarB2));
};

const calculateMutualInformationFromPMF = (jointPMF: JointPMF, varNames: string[], v1_name: string, v2_name: string): number => {
    const p_x = calculateMarginalPMF(jointPMF, varNames, v1_name);
    const p_y = calculateMarginalPMF(jointPMF, varNames, v2_name);
    const v1_idx = varNames.indexOf(v1_name);
    const v2_idx = varNames.indexOf(v2_name);

    let mi = 0;
    jointPMF.forEach((p_xy, key) => {
        const values = key.split(',');
        const v1_val = values[v1_idx];
        const v2_val = values[v2_idx];
        const p1 = p_x.get(v1_val) || p_x.get(Number(v1_val)) || 0;
        const p2 = p_y.get(v2_val) || p_y.get(Number(v2_val)) || 0;
        if (p1 > 0 && p2 > 0 && p_xy > 0) {
            mi += p_xy * Math.log2(p_xy / (p1 * p2));
        }
    });
    return mi;
};

const calculatePearsonCorrelationFromPMF = (jointPMF: JointPMF, varNames: string[], v1: RandomVariable, v2: RandomVariable): number | undefined => {
    if (v1.type !== VariableType.Numerical || v2.type !== VariableType.Numerical) return undefined;
    
    const p_x = calculateMarginalPMF(jointPMF, varNames, v1.name);
    const p_y = calculateMarginalPMF(jointPMF, varNames, v2.name);

    const mean_x = calculateMeanFromPMF(p_x);
    const mean_y = calculateMeanFromPMF(p_y);
    const var_x = calculateVarianceFromPMF(p_x, mean_x);
    const var_y = calculateVarianceFromPMF(p_y, mean_y);

    if (var_x === 0 || var_y === 0) return NaN;

    const v1_idx = varNames.indexOf(v1.name);
    const v2_idx = varNames.indexOf(v2.name);
    let E_xy = 0;
    jointPMF.forEach((p_xy, key) => {
        const values = key.split(',');
        const val1 = Number(values[v1_idx]);
        const val2 = Number(values[v2_idx]);
        E_xy += val1 * val2 * p_xy;
    });

    const covariance = E_xy - (mean_x * mean_y);
    return covariance / (Math.sqrt(var_x) * Math.sqrt(var_y));
};

// --- MODEL & JOINT DISTRIBUTION ---

// FIX: Removed local JointPMF type definition, as it is now imported from types.ts.
const getEmpiricalJointPMF = (variables: RandomVariable[]): JointPMF => {
    const pmf: JointPMF = new Map();
    const n = variables[0]?.data.length || 0;
    if (n === 0) return pmf;
    const counts = new Map<string, number>();
    for (let i = 0; i < n; i++) {
        const key = variables.map(v => v.data[i]).join(',');
        counts.set(key, (counts.get(key) || 0) + 1);
    }
    counts.forEach((count, key) => pmf.set(key, count / n));
    return pmf;
};

const parseTheoreticalModel = (model: TheoreticalModel, varNames: string[]): JointPMF => {
    const lines = model.distribution.trim().split('\n');
    if (lines.length < 2) throw new Error(`Model "${model.name}" has no data rows.`);
    const header = lines[0].split(',').map(h => h.trim());
    const probIndex = header.lastIndexOf('Probability');
    if (probIndex === -1) throw new Error(`Model "${model.name}" is missing 'Probability'.`);
    const modelVarNames = header.slice(0, probIndex).concat(header.slice(probIndex + 1));
    if (modelVarNames.length !== varNames.length || !varNames.every(v => modelVarNames.includes(v))) {
        throw new Error(`Model "${model.name}" variables do not match data.`);
    }
    const pmf: JointPMF = new Map();
    let totalProb = 0;
    for (let i = 1; i < lines.length; i++) {
        const values = lines[i].split(',').map(v => v.trim());
        const prob = parseFloat(values[probIndex]);
        if (isNaN(prob)) throw new Error(`Invalid probability in model "${model.name}" at row ${i}.`);
        const stateValues = values.slice(0, probIndex).concat(values.slice(probIndex + 1));
        const key = varNames.map(name => stateValues[modelVarNames.indexOf(name)]).join(',');
        pmf.set(key, (pmf.get(key) || 0) + prob);
        totalProb += prob;
    }
    if (Math.abs(totalProb - 1.0) > 1e-5) {
        throw new Error(`Probabilities in model "${model.name}" sum to ${totalProb.toFixed(6)}.`);
    }
    return pmf;
};

const calculateMarginalPMF = (jointPMF: JointPMF, varNames: string[], targetVarName: string): MarginalPMF => {
    const marginal: MarginalPMF = new Map();
    const targetIndex = varNames.indexOf(targetVarName);
    if (targetIndex === -1) return marginal;

    jointPMF.forEach((prob, key) => {
        const values = key.split(',');
        const targetValue = values[targetIndex];
        const isNumeric = !isNaN(parseFloat(targetValue));
        const mapKey = isNumeric ? Number(targetValue) : targetValue;
        marginal.set(mapKey, (marginal.get(mapKey) || 0) + prob);
    });
    return marginal;
};


// --- CONDITIONAL ANALYSIS (REFACTORED) ---
const calculateConditionalAnalysisForPair = (jointPMF: JointPMF, v1: RandomVariable, v2: RandomVariable, allVarNames: string[]): { [key: string]: ConditionalResult[] } => {
    const v1Index = allVarNames.indexOf(v1.name);
    const v2Index = allVarNames.indexOf(v2.name);
    const finalResults: { [key: string]: ConditionalResult[] } = {};

    // 1. Calculate the marginal for the 'given' variable (v2).
    const marginalV2 = calculateMarginalPMF(jointPMF, allVarNames, v2.name);

    // 2. Group joint probabilities by the value of the conditioning variable (v2).
    // Structure: Map<v2_value, unnormalized_conditional_pmf_for_v1>
    const groupedPMFs = new Map<string, MarginalPMF>();
    jointPMF.forEach((p_joint, key) => {
        const values = key.split(',');
        const v1_value_str = values[v1Index];
        const v2_value_str = values[v2Index];
        
        if (!groupedPMFs.has(v2_value_str)) {
            groupedPMFs.set(v2_value_str, new Map());
        }
        const conditionalPMF = groupedPMFs.get(v2_value_str)!;
        
        const mapKey = v1.type === VariableType.Numerical ? Number(v1_value_str) : v1_value_str;
        conditionalPMF.set(mapKey, (conditionalPMF.get(mapKey) || 0) + p_joint);
    });

    // 3. Normalize each group to get the final conditional PMFs and calculate metrics.
    groupedPMFs.forEach((unnormalizedPMF, v2_value_str) => {
        const p_v2 = marginalV2.get(v2_value_str) || marginalV2.get(Number(v2_value_str)) || 0;
        
        if (p_v2 > 0) {
            const finalConditionalPMF: MarginalPMF = new Map();
            unnormalizedPMF.forEach((p_joint_sum, v1_value) => {
                finalConditionalPMF.set(v1_value, p_joint_sum / p_v2);
            });

            const metrics = calculateMetricsFromPMF(finalConditionalPMF, v1);
            const conditionResult: ConditionalResult = {
                conditionalVariable: v1.name,
                givenVariable: v2.name,
                conditionValue: String(v2_value_str),
                distribution: metrics.pmf,
                mean: metrics.mean,
                variance: metrics.variance
            };

            if (!finalResults[v2.name]) finalResults[v2.name] = [];
            finalResults[v2.name].push(conditionResult);
        }
    });
    
    return finalResults;
};


// --- MODEL FIT CALCULATIONS ---

const calculateHellingerDistance = (p: JointPMF, q: JointPMF): number => {
    const allKeys = new Set([...p.keys(), ...q.keys()]);
    let sum = 0;
    allKeys.forEach(key => sum += Math.pow(Math.sqrt(p.get(key) || 0) - Math.sqrt(q.get(key) || 0), 2));
    return Math.sqrt(sum) / Math.sqrt(2);
};

const calculateShannonEntropy = (dist: JointPMF): number => {
    let entropy = 0;
    dist.forEach(p_i => { if (p_i > 0) entropy -= p_i * Math.log2(p_i); });
    return entropy;
};

const calculateJSDistance = (p: JointPMF, q: JointPMF): number => {
    const m: JointPMF = new Map();
    const allKeys = new Set([...p.keys(), ...q.keys()]);
    allKeys.forEach(key => m.set(key, ((p.get(key) || 0) + (q.get(key) || 0)) / 2));
    const jsdDivergence = calculateShannonEntropy(m) - (calculateShannonEntropy(p) + calculateShannonEntropy(q)) / 2;
    return Math.sqrt(Math.max(0, jsdDivergence));
};

const calculateMSE = (dataVar: RandomVariable, modelPMF: JointPMF, varNames: string[]): number | undefined => {
    if (dataVar.type !== VariableType.Numerical) return undefined;
    const varIndex = varNames.indexOf(dataVar.name);
    if (varIndex === -1) return undefined;
    let modelMean = 0;
    modelPMF.forEach((prob, key) => {
        const numericVal = parseFloat(key.split(',')[varIndex]);
        if (!isNaN(numericVal)) modelMean += numericVal * prob;
    });
    const dataPoints = dataVar.data.map(Number);
    return dataPoints.map(p => Math.pow(p - modelMean, 2)).reduce((a, b) => a + b, 0) / dataPoints.length;
};

// --- MAIN ANALYSIS ORCHESTRATOR ---

export const performFullAnalysis = (variables: RandomVariable[], theoreticalModels: TheoreticalModel[]): AnalysisResults => {
    const results: AnalysisResults = { single_vars: {}, pairwise: [], modelFit: [], conditional: {}, empiricalJointPMF: new Map() };
    const varNames = variables.map(v => v.name);
    const validModels = theoreticalModels.filter(m => m.distribution.trim() !== '' && m.distribution.trim().split('\n').length >= 2);

    // Parse models first to fail early
    const parsedModels = new Map<string, { model: TheoreticalModel, pmf: JointPMF }>();
    validModels.forEach(model => {
        try {
            parsedModels.set(model.id, { model, pmf: parseTheoreticalModel(model, varNames) });
        } catch (e) {
            results.modelFit.push({ modelName: model.name, error: e instanceof Error ? e.message : String(e) });
        }
    });

    // Single variable analysis
    variables.forEach(v => {
        const empiricalPMF = calculatePMF(v.type === VariableType.Numerical ? v.data.map(Number) : v.data);
        const singleResult: SingleVarResults = {
            empirical: calculateMetricsFromPMF(empiricalPMF, v),
            theoretical: {},
        };

        parsedModels.forEach(({ model, pmf }) => {
            const theoreticalMarginalPMF = calculateMarginalPMF(pmf, varNames, v.name);
            singleResult.theoretical[model.id] = calculateMetricsFromPMF(theoreticalMarginalPMF, v);
        });
        results.single_vars[v.id] = singleResult;
    });
    
    const empiricalPMF = getEmpiricalJointPMF(variables);
    results.empiricalJointPMF = empiricalPMF;

    // Pairwise & Conditional analysis
    if (variables.length > 1) {
        for (let i = 0; i < variables.length; i++) {
            for (let j = i + 1; j < variables.length; j++) {
                const v1 = variables[i];
                const v2 = variables[j];
                const pairKey = `${v1.id}-${v2.id}`;
                
                // Pairwise Correlations
                const pairwiseResult: PairwiseResult = { 
                    var1_id: v1.id, 
                    var1_name: v1.name, 
                    var2_id: v2.id, 
                    var2_name: v2.name,
                    empirical: {},
                    theoretical: {}
                };
                
                // Empirical metrics
                const empiricalMetrics: PairwiseMetrics = {};
                if (v1.type === VariableType.Numerical && v2.type === VariableType.Numerical) {
                    empiricalMetrics.pearsonCorrelation = calculatePearsonCorrelation(v1.data.map(Number), v2.data.map(Number));
                }
                empiricalMetrics.mutualInformation = calculateMutualInformation(v1.data, v2.data);
                empiricalMetrics.distanceCorrelation = calculateDistanceCorrelation(v1.data, v1.type === VariableType.Numerical, v2.data, v2.type === VariableType.Numerical);
                pairwiseResult.empirical = empiricalMetrics;
                
                // Theoretical metrics
                parsedModels.forEach(({ model, pmf }) => {
                    const theoreticalMetrics: PairwiseMetrics = {};
                    theoreticalMetrics.mutualInformation = calculateMutualInformationFromPMF(pmf, varNames, v1.name, v2.name);
                    theoreticalMetrics.pearsonCorrelation = calculatePearsonCorrelationFromPMF(pmf, varNames, v1, v2);
                    // Distance Correlation from PMF is not implemented due to complexity
                    pairwiseResult.theoretical[model.id] = theoreticalMetrics;
                });

                results.pairwise.push(pairwiseResult);

                // Conditional Analysis
                const conditional: PairwiseConditionalAnalysis = { empirical: {}, theoretical: {} };
                conditional.empirical = {
                    ...calculateConditionalAnalysisForPair(empiricalPMF, v1, v2, varNames),
                    ...calculateConditionalAnalysisForPair(empiricalPMF, v2, v1, varNames)
                };
                parsedModels.forEach(({ model, pmf }) => {
                     conditional.theoretical[model.id] = {
                        ...calculateConditionalAnalysisForPair(pmf, v1, v2, varNames),
                        ...calculateConditionalAnalysisForPair(pmf, v2, v1, varNames)
                     };
                });
                results.conditional[pairKey] = conditional;
            }
        }
    }
    
    // Model Fit analysis
    parsedModels.forEach(({ model, pmf }) => {
        const fitResult: ModelFitResult = { modelName: model.name };
        fitResult.hellingerDistance = calculateHellingerDistance(empiricalPMF, pmf);
        fitResult.jensenShannonDistance = calculateJSDistance(empiricalPMF, pmf);
        fitResult.mse = {};
        variables.forEach(v => {
            const mse = calculateMSE(v, pmf, varNames);
            if (mse !== undefined && fitResult.mse) fitResult.mse[v.name] = mse;
        });
        results.modelFit.push(fitResult);
    });

    return results;
};

// --- EXPORT FUNCTIONS ---

export const exportToJson = (results: AnalysisResults): string => JSON.stringify(results, null, 2);

export const exportToCsv = (results: AnalysisResults, variables: RandomVariable[]): string => {
    let csv = '';
    csv += 'Single Variable Analysis\n';
    csv += 'Variable Name,Type,Metric,Value\n';
    variables.forEach(v => {
        const res = results.single_vars[v.id].empirical;
        const formatVal = (val: any) => val === undefined || val === null ? 'N/A' : val;
        csv += `"${v.name}","${v.type}",Mean,${formatVal(res.mean?.toFixed(4))}\n`;
        csv += `"${v.name}","${v.type}",Variance,${formatVal(res.variance?.toFixed(4))}\n`;
        csv += `"${v.name}","${v.type}",Mode,${Array.isArray(res.mode) && res.mode.length > 0 ? `"${res.mode.join('; ')}"` : 'N/A'}\n`;
        csv += `"${v.name}","${v.type}",Median,${formatVal(res.median)}\n`;
    });
    if(results.pairwise.length > 0) {
        csv += '\nPairwise Dependence Analysis\n';
        csv += 'Variable 1,Variable 2,Distance Correlation,Pearson Correlation,Mutual Information\n';
        results.pairwise.forEach(p => {
            csv += `"${p.var1_name}","${p.var2_name}",${p.empirical.distanceCorrelation?.toFixed(4) ?? 'N/A'},${p.empirical.pearsonCorrelation?.toFixed(4) ?? 'N/A'},${p.empirical.mutualInformation?.toFixed(4) ?? 'N/A'}\n`;
        });
    }
    if (results.modelFit.length > 0) {
        csv += '\nModel Fit Analysis\n';
        csv += 'Model Name,Metric,Variable,Value\n';
        results.modelFit.forEach(m => {
            if (m.error) {
                csv += `"${m.modelName}","Error","N/A","${m.error}"\n`;
            } else {
                csv += `"${m.modelName}",Hellinger Distance,N/A,${m.hellingerDistance?.toFixed(4) ?? 'N/A'}\n`;
                csv += `"${m.modelName}",Jensen-Shannon Distance,N/A,${m.jensenShannonDistance?.toFixed(4) ?? 'N/A'}\n`;
                if (m.mse) {
                    Object.entries(m.mse).forEach(([varName, value]) => {
                         csv += `"${m.modelName}",Mean Squared Error,"${varName}",${value.toFixed(4)}\n`;
                    });
                }
            }
        });
    }
    return csv;
};
