
export enum VariableType {
    Numerical = 'Numerical',
    Nominal = 'Nominal',
    Ordinal = 'Ordinal',
}

export interface RandomVariable {
    id: string;
    name: string;
    data: string[];
    type: VariableType;
    ordinalOrder: string[];
}

export type Distribution = {
    value: string | number;
    probability: number;
    cumulative: number;
}[];

export interface SingleVarResults {
    pmf: Distribution;
    mean?: number;
    variance?: number;
    mode?: (string | number)[];
    median?: string | number;
}

export interface PairwiseResult {
    var1_id: string;
    var1_name: string;
    var2_id: string;
    var2_name: string;
    distanceCorrelation?: number;
    pearsonCorrelation?: number;
    mutualInformation?: number;
}

export interface AnalysisResults {
    single_vars: {
        [key: string]: SingleVarResults;
    };
    pairwise: PairwiseResult[];
}
