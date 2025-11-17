import { type TheoreticalModel, type JointPMF, VariableType } from '../types';

export const createDistributionStringFromModel = (model: TheoreticalModel, varNames: string[]): string => {
    if (varNames.length === 0) return '';
    const header = [...varNames, 'Probability'].join(',');
    const rows = Object.entries(model.jointProbabilities)
        .map(([key, probStr]) => {
            const prob = parseFloat(probStr as string);
            if (!key || isNaN(prob) || prob <= 0) return null;
            return `${key},${prob}`;
        })
        .filter(Boolean);

    return [header, ...rows].join('\n');
};

export const parseInput = (text: string): { name: string; data: string[] }[] => {
    const lines = text.trim().split('\n').filter(line => line.trim() !== '');
    if (lines.length < 2) {
        throw new Error("Input data must contain a header row and at least one data row.");
    }

    const header = lines[0].split(',').map(h => h.trim());
    const headerLength = header.length;
    if (headerLength === 0) {
        throw new Error("Header row is empty or invalid.");
    }
    
    const dataRows = lines.slice(1);
    const variables: { name: string; data: string[] }[] = header.map(name => ({ name, data: [] }));

    dataRows.forEach((row, rowIndex) => {
        const values = row.split(',').map(v => v.trim());
        if (values.length !== headerLength) {
            throw new Error(`Data row ${rowIndex + 1} has ${values.length} columns, but header has ${headerLength}. All rows must have the same number of columns.`);
        }
        values.forEach((value, index) => {
            if (variables[index]) variables[index].data.push(value);
        });
    });

    return variables.filter(v => v.name);
};

/**
 * Parses a theoretical model's distribution string into a JointPMF.
 */
export const parseTheoreticalModel = (model: TheoreticalModel, varNamesInOrder: string[]): JointPMF | string => {
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
