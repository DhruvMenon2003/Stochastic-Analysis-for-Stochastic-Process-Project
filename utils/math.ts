import { type Distribution, type JointPMF, VariableType } from '../types';
import { detectVariableType } from './typeUtils';

/**
 * Calculates the mean of a numerical distribution.
 */
export const calculateMean = (dist: Distribution): number => {
    return dist.reduce((acc, { value, probability }) => acc + Number(value) * probability, 0);
};

/**
 * Calculates the variance of a numerical distribution.
 */
export const calculateVariance = (dist: Distribution, mean: number): number => {
    return dist.reduce((acc, { value, probability }) => acc + Math.pow(Number(value) - mean, 2) * probability, 0);
};

/**
 * Calculates the mode(s) of a distribution.
 */
export const calculateMode = (dist: Distribution): (string | number)[] => {
    if (dist.length === 0) return [];
    const maxProb = Math.max(...dist.map(p => p.probability));
    // Use a small epsilon for floating point comparison
    return dist.filter(p => Math.abs(p.probability - maxProb) < 1e-9).map(p => p.value);
};

/**
 * Calculates the median of a distribution.
 */
export const calculateMedian = (dist: Distribution, type: VariableType, ordinalOrder: string[]): string | number | undefined => {
    if (dist.length === 0) return undefined;
    
    let sortedDist = [...dist];
    if (type === VariableType.Numerical) {
        sortedDist.sort((a, b) => Number(a.value) - Number(b.value));
    } else if (type === VariableType.Ordinal && ordinalOrder.length > 0) {
        sortedDist.sort((a, b) => ordinalOrder.indexOf(String(a.value)) - ordinalOrder.indexOf(String(b.value)));
    }

    let cumulative = 0;
    for (const point of sortedDist) {
        cumulative += point.probability;
        if (cumulative >= 0.5) {
            return point.value;
        }
    }
    return sortedDist[sortedDist.length - 1].value;
};

/**
 * Calculates Pearson correlation for two numerical variables.
 */
export const calculatePearsonCorrelation = (data1: string[], data2: string[]): number => {
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
export const calculateMutualInformation = (jointPMF: JointPMF, marginal1: JointPMF, marginal2: JointPMF): number => {
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
 export const calculateDistanceCorrelation = (data1: string[], data2: string[]): number => {
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
 * Calculates Cramer's V for two categorical variables.
 */
export const calculateCramersV = (data1: string[], data2: string[]): number => {
    const n = data1.length;
    if (n === 0) return 0;

    const levels1 = [...new Set(data1)];
    const levels2 = [...new Set(data2)];
    const r = levels1.length;
    const k = levels2.length;
    if (r < 2 || k < 2) return 0;

    const contingencyTable: { [key1: string]: { [key2: string]: number } } = {};
    levels1.forEach(l1 => {
        contingencyTable[l1] = {};
        levels2.forEach(l2 => contingencyTable[l1][l2] = 0);
    });

    for (let i = 0; i < n; i++) {
        contingencyTable[data1[i]][data2[i]]++;
    }

    let chi2 = 0;
    for (let i = 0; i < r; i++) {
        for (let j = 0; j < k; j++) {
            const rowTotal = Object.values(contingencyTable[levels1[i]]).reduce((a, b) => a + b, 0);
            const colTotal = levels1.reduce((sum, l1) => sum + contingencyTable[l1][levels2[j]], 0);
            const expected = (rowTotal * colTotal) / n;
            if (expected > 0) {
                const observed = contingencyTable[levels1[i]][levels2[j]];
                chi2 += Math.pow(observed - expected, 2) / expected;
            }
        }
    }
    
    const minDim = Math.min(k - 1, r - 1);
    if (minDim === 0) return 0;

    return Math.sqrt(chi2 / (n * minDim));
};

/**
 * Calculates the Hellinger distance between two probability mass functions.
 */
export const calculateHellingerDistance = (pmf1: JointPMF, pmf2: JointPMF): number => {
    const allKeys = new Set([...pmf1.keys(), ...pmf2.keys()]);
    let sumOfSquaredDiffs = 0;

    for (const key of allKeys) {
        const p1 = pmf1.get(key) || 0;
        const p2 = pmf2.get(key) || 0;
        sumOfSquaredDiffs += Math.pow(Math.sqrt(p1) - Math.sqrt(p2), 2);
    }

    return (1 / Math.sqrt(2)) * Math.sqrt(sumOfSquaredDiffs);
};

/**
 * Calculates the Shannon entropy (base 2) of a probability mass function.
 */
export const calculateShannonEntropy = (pmf: JointPMF): number => {
    let total = 0;
    for (const p of pmf.values()) {
        total += p;
    }
    if (Math.abs(total) < 1e-9) return 0;

    let H = 0;
    for (const p of pmf.values()) {
        if (p > 0) {
            const normalizedP = p / total;
            H -= normalizedP * Math.log2(normalizedP);
        }
    }
    return H;
};

/**
 * Calculates the Generalized Jensen-Shannon Divergence for multiple PMFs.
 */
export const calculateGeneralizedJensenShannonDivergence = (pmfs: JointPMF[]): number => {
    const n = pmfs.length;
    if (n < 2) return 0;

    const mixturePmf: JointPMF = new Map();
    const allKeys = new Set<string>();
    pmfs.forEach(pmf => pmf.forEach((_, key) => allKeys.add(key)));

    for(const key of allKeys) {
        let sumProb = 0;
        pmfs.forEach(pmf => {
            sumProb += pmf.get(key) || 0;
        });
        mixturePmf.set(key, sumProb / n);
    }
    
    const H_M = calculateShannonEntropy(mixturePmf);
    
    const H_sum = pmfs.reduce((sum, pmf) => sum + calculateShannonEntropy(pmf), 0);
    const H_mean = H_sum / n;

    return Math.max(0, H_M - H_mean);
};
