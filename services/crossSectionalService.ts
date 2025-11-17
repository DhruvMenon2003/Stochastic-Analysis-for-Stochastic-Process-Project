import {
    type RandomVariable, type AnalysisResults, type TheoreticalModel, type SingleVarResults,
    type PairwiseResult, type ModelFitResult, type JointPMF, type PairwiseConditionalAnalysis,
    type PairwiseMetrics, VariableType
} from '../types';
import {
    calculateDistanceCorrelation, calculateMutualInformation, calculatePearsonCorrelation,
    calculateCramersV, calculateHellingerDistance, calculateGeneralizedJensenShannonDivergence
} from '../utils/math';
import { getEmpiricalJointPMF, getMarginalPMF, getSingleVarMetrics, getConditionalDistributions } from '../utils/distribution';
import { parseTheoreticalModel } from './parserService';

export const performFullAnalysis = (variables: RandomVariable[], theoreticalModels: TheoreticalModel[] = []): AnalysisResults => {
    if (variables.length === 0 || variables[0]?.data.length === 0) {
        throw new Error("Cannot perform analysis on empty dataset.");
    }
    
    const numVars = variables.length;
    
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
            
            const isVar1Categorical = var1.type === VariableType.Nominal || var1.type === VariableType.Ordinal;
            const isVar2Categorical = var2.type === VariableType.Nominal || var2.type === VariableType.Ordinal;

            pairwise.push({
                var1_id: var1.id, var1_name: var1.name, var2_id: var2.id, var2_name: var2.name,
                empirical: {
                    distanceCorrelation: calculateDistanceCorrelation(var1.data, var2.data),
                    mutualInformation: calculateMutualInformation(jointPMF, marginal1, marginal2),
                    pearsonCorrelation: (var1.type === VariableType.Numerical && var2.type === VariableType.Numerical) ? calculatePearsonCorrelation(var1.data, var2.data) : undefined,
                    cramersV: (isVar1Categorical && isVar2Categorical) ? calculateCramersV(var1.data, var2.data) : undefined,
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
    const varNamesInOrder = variables.map(v => v.name);
    const theoreticalJointPMFs: { [modelId: string]: JointPMF } = {};

    theoreticalModels.forEach(model => {
        const parsedModelPMF = parseTheoreticalModel(model, varNamesInOrder);
        
        if (typeof parsedModelPMF === 'string') {
            modelFit.push({ modelName: model.name, error: parsedModelPMF });
            return;
        }

        if (parsedModelPMF.size === 0) {
            return;
        }
        
        theoreticalJointPMFs[model.id] = parsedModelPMF;
        
        const mseMetrics: { [metricName: string]: number } = {};

        // Calculate single var, pairwise, and conditional for the model
        variables.forEach((v, i) => {
             const modelMarginalPMF = getMarginalPMF(parsedModelPMF, [i], numVars);
             single_vars[v.id].theoretical[model.id] = getSingleVarMetrics(modelMarginalPMF, v.type, v.ordinalOrder);
        });

        for (let i = 0; i < numVars; i++) {
            for (let j = i + 1; j < numVars; j++) {
                const var1 = variables[i];
                const var2 = variables[j];
                const pairKey = [var1.id, var2.id].sort().join('-');

                const modelPairPMF = getMarginalPMF(parsedModelPMF, [i, j], numVars);
                const modelMarginal1 = getMarginalPMF(parsedModelPMF, [i], numVars);
                const modelMarginal2 = getMarginalPMF(parsedModelPMF, [j], numVars);
                
                const pairResult = pairwise.find(p => p.var1_id === var1.id && p.var2_id === var2.id);
                if (pairResult) {
                     const isVar1Categorical = var1.type === VariableType.Nominal || var1.type === VariableType.Ordinal;
                     const isVar2Categorical = var2.type === VariableType.Nominal || var2.type === VariableType.Ordinal;
                     
                     // Need to get model data to calculate Cramer's V. This is complex.
                     // For now, only calculating MI for theoretical models.
                    pairResult.theoretical[model.id] = {
                        mutualInformation: calculateMutualInformation(modelPairPMF, modelMarginal1, modelMarginal2),
                    };
                }
                
                if (conditional[pairKey]) {
                   conditional[pairKey].theoretical[model.id] = getConditionalDistributions(modelPairPMF, modelMarginal1, modelMarginal2, var1, var2);
                }
            }
        }
        
        // --- MSE Calculations ---

        // Single-variable MSE for numerical variables
        variables.forEach(v => {
            if (v.type === VariableType.Numerical) {
                const empiricalMetrics = single_vars[v.id].empirical;
                const modelMetrics = single_vars[v.id].theoretical[model.id];
                if (empiricalMetrics.mean !== undefined && modelMetrics.mean !== undefined && modelMetrics.variance !== undefined) {
                    const bias = modelMetrics.mean - empiricalMetrics.mean;
                    const mse = modelMetrics.variance + (bias * bias);
                    mseMetrics[`MSE: ${v.name}`] = mse;
                }
            }
        });

        // Conditional MSE (Numerical | Categorical)
        for (let i = 0; i < numVars; i++) {
            for (let j = 0; j < numVars; j++) {
                if (i === j) continue;
                
                const targetVar = variables[i];
                const givenVar = variables[j];
                
                const isTargetNumerical = targetVar.type === VariableType.Numerical;
                const isGivenCategorical = givenVar.type === VariableType.Nominal || givenVar.type === VariableType.Ordinal;

                if (isTargetNumerical && isGivenCategorical) {
                    const pairKey = [targetVar.id, givenVar.id].sort().join('-');
                    const modelConditionals = conditional[pairKey]?.theoretical[model.id]?.[givenVar.name];
                    const empiricalMarginal = single_vars[givenVar.id].empirical.pmf;
                    
                    if (!modelConditionals || !empiricalMarginal) continue;

                    const predictions = new Map<string, number>(); // conditionValue -> predictedMean
                    modelConditionals.forEach(cond => {
                        if (cond.mean !== undefined) predictions.set(cond.conditionValue, cond.mean);
                    });
                    
                    const squaredErrorsByCondition: { [condition: string]: number[] } = {};
                    
                    for (let k = 0; k < targetVar.data.length; k++) {
                        const trueValue = Number(targetVar.data[k]);
                        const conditionValue = givenVar.data[k];
                        const predictedValue = predictions.get(conditionValue);
                        
                        if (!isNaN(trueValue) && predictedValue !== undefined) {
                            const sqError = Math.pow(trueValue - predictedValue, 2);
                            if (!squaredErrorsByCondition[conditionValue]) {
                                squaredErrorsByCondition[conditionValue] = [];
                            }
                            squaredErrorsByCondition[conditionValue].push(sqError);
                        }
                    }
                    
                    let cumulativeMSE = 0;
                    
                    Object.entries(squaredErrorsByCondition).forEach(([condition, errors]) => {
                        if (errors.length > 0) {
                            const mse = errors.reduce((a, b) => a + b, 0) / errors.length;
                            const perConditionMetricName = `MSE: ${targetVar.name} | ${givenVar.name}=${condition}`;
                            mseMetrics[perConditionMetricName] = mse;
                            
                            const marginalProb = empiricalMarginal.find(p => p.value == condition)?.probability || 0;
                            cumulativeMSE += mse * marginalProb;
                        }
                    });
                    
                    if (cumulativeMSE > 0) {
                        const metricName = `Cumulative MSE (${targetVar.name} | ${givenVar.name})`;
                        mseMetrics[metricName] = cumulativeMSE;
                    }
                }
            }
        }

        modelFit.push({
            modelName: model.name,
            hellingerDistance: calculateHellingerDistance(empiricalJointPMF, parsedModelPMF),
            jensenShannonDistance: Math.sqrt(calculateGeneralizedJensenShannonDivergence([empiricalJointPMF, parsedModelPMF])),
            mse: mseMetrics
        });
    });
    
    return { variables, single_vars, pairwise, modelFit, conditional, empiricalJointPMF, theoreticalJointPMFs };
};
