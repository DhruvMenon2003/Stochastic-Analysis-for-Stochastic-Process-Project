import { VariableType } from '../types';

/**
 * Detects the type of a variable based on its data.
 */
export const detectVariableType = (data: string[]): VariableType => {
    if (data.every(d => d === '' || !isNaN(Number(d)))) {
        return VariableType.Numerical;
    }
    return VariableType.Nominal;
};

/**
 * Checks if the input data format matches the time-series criteria.
 */
export const detectAnalysisType = (text: string): 'time-series' | 'cross-sectional' => {
    const lines = text.trim().split('\n');
    if (lines.length < 2) return 'cross-sectional';

    const header = lines[0].split(',').map(h => h.trim().toLowerCase());
    if (header.length < 2) return 'cross-sectional';

    if (header[0] !== 'time') return 'cross-sectional';

    for (let i = 1; i < header.length; i++) {
        if (!header[i].startsWith('instance')) {
             return 'cross-sectional';
        }
    }

    return 'time-series';
};
