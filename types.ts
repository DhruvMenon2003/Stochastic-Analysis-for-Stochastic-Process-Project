

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
    variables: RandomVariable[];
    single_vars: { [variableId: string]: SingleVarResults };
    pairwise: PairwiseResult[];
    modelFit: ModelFitResult[];
    conditional: { [pairKey: string]: PairwiseConditionalAnalysis };
    empiricalJointPMF: JointPMF;
    theoreticalJointPMFs: { [modelId: string]: JointPMF };
}

export interface TheoreticalModel {
    id: string;
    name: string;
    distribution: string;
    stateSpaces: { [varName: string]: string };
    jointProbabilities: { [key: string]: string | number };
}

export interface ModelFitResult {
    modelName: string;
    hellingerDistance?: number;
    jensenShannonDistance?: number;
    mse?: { [metricName: string]: number };
    error?: string;
}

export type TPM = Map<string, Map<string, number>>;

export interface HellingerResult {
    pair: string;
    distance: number;
}

export interface TimeSeriesAnalysisResults {
    isHomogeneous: boolean;
    homogeneityMetrics: {
        hellingerDistances: HellingerResult[];
        gjsDivergence: number;
    };
    markovianFit: {
        fullHistoryPMF: JointPMF;
        markovApproximationPMF: JointPMF;
        initialStatePMF: JointPMF;
        hellingerDistance: number;
        jensenShannonDistance: number;
    };
    tpms_firstOrder: { tpm: TPM; label: string }[];
    tpm_fullHistory: { tpm: TPM; label: string };
    average_tpm_firstOrder: { tpm: TPM; label: string };
    weakStationarity: {
        mean: number[];
        variance: number[];
        timeLabels: string[];
    };
    stateSpace: string[];
}