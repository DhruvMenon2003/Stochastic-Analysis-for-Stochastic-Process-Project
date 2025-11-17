import { type AnalysisResults, type RandomVariable, type SingleVarMetrics, type PairwiseMetrics } from '../types';

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

        const pairwiseMetrics: (keyof PairwiseMetrics)[] = ['distanceCorrelation', 'pearsonCorrelation', 'mutualInformation', 'cramersV'];
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
