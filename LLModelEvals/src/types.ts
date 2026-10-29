export interface ScoreInterval90 {
    lower: number;
    upper: number;
    scope: string;
    validatedFutureTruth: boolean;
    coverageValidated: boolean;
    simultaneousRosterCoverageValidated: boolean;
}

export interface ModelBenchmarkRanking {
    rank: number;
    slug: string;
    canonicalModelKey: string;
    model: string;
    creator: string;
    sourceType: "Proprietary" | "Open Source" | string;
    reasoningType: "Reasoning" | "Standard" | string;
    contextWindow: string;
    contextWindowTokens: number;
    displayScore: number;
    provisionalDisplayScore: number;
    publicRankingMode: string;
    evidenceStatus: string;
    scoreInterval90: ScoreInterval90;
    orderingMeaning: string;
    rankingEligible: boolean;
    overallRank: number;
    url: string;
    markdownUrl: string;
    score: number;
    rankingMode: string;
    category: "coding" | string;
    categoryLabel: string;
    trustedBenchmarkCount: number;
    scoreConfidence: number;
}


export interface ModelPricingSpec {
    canonicalModelKey: string;
    slug: string;
    model: string;
    creator: string;
    sourceType: "Open Weight" | "Proprietary" | "Evaluated configuration" | string;
    contextWindow: string | null;
    contextWindowTokens: number;
    inputPrice: number | null;
    outputPrice: number | null;
    cachedInputPrice: number | null;
    trainingPrice: number | null;
    note: string;
    hasNumericPricing: boolean;
    isFreePricing: boolean;
    displayScore: number | null;
    overallRank: number | null;
    scorePerOutputDollar: number | null;
    url: string;
    markdownUrl: string;
}

export interface ModelFamily {
    familyKey: string;
    familyName: string;
    variantType: string;
    snapshotLabel: string | null;
    baseFamilyModelKey: string;
    relatedModelKeys: string[];
    isCanonicalFamilyEntry: boolean;
    supersedesModelKey: string | null;
}

export interface CategoryScores {
    agentic?: number | null;
    coding?: number | null;
    reasoning?: number | null;
    multimodalGrounded?: number | null;
    knowledge?: number | null;
    multilingual?: number | null;
    instructionFollowing?: number | null;
    math?: number | null;
    [category: string]: number | null | undefined;
}

export interface ModelScores {
    displayScore: number;
    overallScore: number;
    rawOverallScore: number;
    verifiedDisplayScore: number;
    displayCategoryScores: CategoryScores;
    verifiedDisplayCategoryScores: CategoryScores;
}

export interface ModelRankingDetails {
    rankingEligible: boolean;
    verifiedRankingEligible: boolean;
    overallRank: number;
    categoryRanks: Record<string, number>;
    categoryRankingEligible: Record<string, boolean>;
}

export interface ModelCoverage {
    trustedBenchmarkCount: number;
    verifiedBenchmarkCount: number;
    rankableBenchmarkCount: number;
    generatedBenchmarkCount: number;
    scoreConfidence: number;
}

export interface BenchmarkSourceDetail {
    publisher: string;
    publisherUrl: string;
    sourceLabel: string;
    sourceRole: string;
    scope: string;
    datasetContentsIncluded: boolean;
    licenseGrantIncluded: boolean;
    label: string;
    url: string;
    benchmarkUrl: string;
    retrievedAt: string | null;
}

// Full Model Profile
export interface ModelDetailProfile {
    id: number;
    slug: string;
    canonicalModelKey: string;
    model: string;
    creator: string;
    sourceType: "Proprietary" | "Open Source" | "Open Weight" | string;
    reasoningType: "Reasoning" | "Standard" | string;
    contextWindow: string | null;
    contextWindowTokens: number;
    displayScore: number;
    provisionalDisplayScore: number;
    publicRankingMode: string;
    evidenceStatus: string;
    scoreInterval90: ScoreInterval90;
    orderingMeaning: string;
    rankingEligible: boolean;
    overallRank: number;
    url: string;
    markdownUrl: string;
    releaseDate: string;
    market: string | null;
    isRegional: boolean;

    // Nested structures
    family: ModelFamily;
    scores: ModelScores;
    ranking: ModelRankingDetails;
    coverage: ModelCoverage;

    // Benchmarks & Sources by Category
    benchmarks: Record<string, Record<string, number>>;
    benchmarkSources?: Record<string, Record<string, BenchmarkSourceDetail>>;
}

export interface ModelSpeedSpec {
    canonicalModelKey: string;
    slug: string;
    model: string;
    creator: string;
    tokensPerSecond: number;
    ttft: number; // Time To First Token in seconds
    source: string;
    sourceUrl: string;
    sourceUpdatedAt: string;
    displayScore: number;
    overallRank: number | null;
    url: string;
    markdownUrl: string;
}

export interface SpeedDataSource {
    name: string;
    url: string;
    updatedAt: string;
    speedLabel: string;
    latencyLabel: string;
}

export interface SpeedDataFile {
    schemaVersion: string;
    name: string;
    description: string;
    canonicalUrl: string;
    license: string;
    licenseUrl: string;
    termsUrl: string;
    commercialUse: string;
    attribution: string;
    generatedAt: string;
    sourceLastUpdated: string;
    sourceFiles: string[];
    manifestUrl: string;
    source: SpeedDataSource;
    counts: {
        speedRows: number;
        matchedModelRows: number;
    };
    items: ModelSpeedSpec[];
}

// ==========================================
// Merged Single Schema for Final Benchmarking
// ==========================================
export interface MergedModelCandidate {
    rank : number
    name: string; // model name
    canonicalModelKey :string ;
    creator: string;
    sourceType: string;
    contextWindowTokens: number;

    // 2. Coding & Deep Benchmark Scores
    overAllScore: number
    codingScore: number;
    reasoningScore: number ;
    mathScore: number;
    multimodalGroundedScore: number;

    // 3. Pricing & Real Financials (INR)
    inputPrice: number;
    outputPrice: number;
    isFreePricing: boolean;
    monthlyCostINR: number; // based on avg tokens * requests/day * 30 days

    // 4. Performance & Latency SLA
    tokensPerSecond: number ;
    ttft: number ; // Time to First Token in seconds

}

export interface MergedModelCandidateNormalised extends MergedModelCandidate {
    normalisedLatency : number ,
    normalisedReasoningScore: number ,
    normalisedCodingScore : number ,
    normalisedMultimodalGroundedScore :number ,
    normalisedMathScore : number ,
    UseCaseScore : number ,
}


