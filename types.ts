
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

export interface SingleVarMetrics {
    pmf: Distribution;
    mean?: number;
    variance?: number;
    mode?: (string | number)[];
    median?: string | number;
}

export interface SingleVarResults {
    empirical: SingleVarMetrics;
    theoretical: { [modelId: string]: SingleVarMetrics };
}

export interface PairwiseMetrics {
    pearsonCorrelation?: number;
    mutualInformation?: number;
    distanceCorrelation?: number;
}

export interface PairwiseResult {
    var1_id: string;
    var1_name: string;
    var2_id: string;
    var2_name: string;
    empirical: PairwiseMetrics;
    theoretical: { [modelId: string]: PairwiseMetrics };
}

export interface ConditionalResult {
    conditionalVariable: string;
    givenVariable: string;
    conditionValue: string;
    distribution: Distribution;
    mean?: number;
    variance?: number;
}

export interface PairwiseConditionalAnalysis {
    empirical: { [givenVariableName: string]: ConditionalResult[] };
    theoretical: { [modelId: string]: { [givenVariableName: string]: ConditionalResult[] } };
}

export type JointPMF = Map<string, number>;

export interface AnalysisResults {
    single_vars: { [variableId: string]: SingleVarResults };
    pairwise: PairwiseResult[];
    modelFit: ModelFitResult[];
    conditional: { [pairKey: string]: PairwiseConditionalAnalysis };
    empiricalJointPMF: JointPMF;
}

export interface TheoreticalModel {
    id: string;
    name: string;
    distribution: string;
    stateSpaces: { [varName: string]: string };
    jointProbabilities: { [key: string]: string };
}

export interface ModelFitResult {
    modelName: string;
    hellingerDistance?: number;
    jensenShannonDistance?: number;
    mse?: { [variableName: string]: number };
    error?: string;
}
