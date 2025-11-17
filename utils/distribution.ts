import { type JointPMF, type Distribution, VariableType, type RandomVariable, type SingleVarMetrics, type ConditionalResult } from '../types';
import { calculateMean, calculateVariance, calculateMode, calculateMedian } from './math';

/**
 * Converts a PMF map to a Distribution array with cumulative probabilities.
 */
export const pmfToDistribution = (pmf: JointPMF, type: VariableType, ordinalOrder: string[]): Distribution => {
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
export const getSingleVarMetrics = (pmf: JointPMF, type: VariableType, ordinalOrder: string[]): SingleVarMetrics => {
    const distribution = pmfToDistribution(pmf, type, ordinalOrder);
    const metrics: SingleVarMetrics = {
        pmf: distribution,
        mode: calculateMode(distribution),
        median: calculateMedian(distribution, type, ordinalOrder),
    };

    if (type === VariableType.Numerical && distribution.every(p => !isNaN(Number(p.value)))) {
        metrics.mean = calculateMean(distribution);
        if(metrics.mean !== undefined){
            metrics.variance = calculateVariance(distribution, metrics.mean);
        }
    }

    return metrics;
};

/**
 * Calculates the joint probability mass function from the raw data.
 */
export const getEmpiricalJointPMF = (variables: RandomVariable[]): JointPMF => {
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
export const getMarginalPMF = (jointPMF: JointPMF, varIndicesToKeep: number[], numTotalVars: number): JointPMF => {
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
 * Calculates conditional distributions for a pair of variables.
 */
export const getConditionalDistributions = (
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
            if(result.mean !== undefined) {
                result.variance = calculateVariance(dist, result.mean);
            }
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
             if(result.mean !== undefined) {
                result.variance = calculateVariance(dist, result.mean);
            }
        }
        results[var1.name].push(result);
    }
    
    return results;
};

/**
 * Cartesian product utility
 */
export const cartesianProduct = <T,>(...arrays: T[][]): T[][] => {
    return arrays.reduce<T[][]>(
        (acc, curr) => {
            if (acc.length === 0) return curr.map(item => [item]);
            return acc.flatMap(a => curr.map(c => [...a, c]));
        },
        []
    );
};
