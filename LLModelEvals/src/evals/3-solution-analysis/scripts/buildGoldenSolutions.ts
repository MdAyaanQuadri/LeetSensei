import * as fs from "node:fs/promises";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import type {
  SolutionAnalysisInput,
  SolutionQuestionRubricItem
} from "../types.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const dataDir = path.resolve(__dirname, "../data");

interface RawQuestion {
  questionFrontendId: string;
  title: string;
  difficulty: "Easy" | "Medium" | "Hard";
  body: string;
  constraints: string[];
}

async function generate() {
  const stage2DatasetRaw = await fs.readFile(
    path.resolve(__dirname, "../../2-question-analysis/data/goldenDatasetEnriched.json"),
    "utf-8"
  );
  const stage2Questions = JSON.parse(stage2DatasetRaw) as RawQuestion[];
  const questionMap = new Map(stage2Questions.map((q) => [q.questionFrontendId, q]));

  const goldenSolutions: SolutionAnalysisInput[] = [];
  const solutionRubics: SolutionQuestionRubricItem[] = [];

  // =========================================================================
  // 1. Q#42: Trapping Rain Water (Hard)
  // =========================================================================
  const q42 = questionMap.get("42")!;
  
  // 1a. Optimal: Two-pointer O(n) time, O(1) space
  goldenSolutions.push({
    questionFrontendId: "42",
    title: q42.title,
    difficulty: q42.difficulty,
    body: q42.body,
    constraints: q42.constraints,
    questionAnalysis: {
      crux: "Calculate total trapped rainwater bounded between elevation bars along the 1D profile.",
      optimalTimeComplexity: "O(n)",
      optimalSpaceComplexity: "O(1)",
      allowedTopicSlugs: ["array", "two-pointers", "dynamic-programming", "monotonic-stack"]
    },
    submission: {
      submissionId: "sub_42_opt",
      language: "Python3",
      code: `class Solution:
    def trap(self, height: list[int]) -> int:
        if not height:
            return 0
        left, right = 0, len(height) - 1
        left_max, right_max = height[left], height[right]
        water = 0
        while left < right:
            if left_max < right_max:
                left += 1
                left_max = max(left_max, height[left])
                water += left_max - height[left]
            else:
                right -= 1
                right_max = max(right_max, height[right])
                water += right_max - height[right]
        return water`,
      runtimePercentile: 95.4,
      memoryPercentile: 91.2
    }
  });

  solutionRubics.push({
    testCaseId: "42_optimal",
    questionFrontendId: "42",
    title: q42.title,
    solutionType: "optimal",
    expectedUserUsedTopics: ["two-pointers"],
    expectedUserTime: "O(n)",
    expectedUserSpace: "O(1)",
    optimalTime: "O(n)",
    optimalSpace: "O(1)",
    isTimeOptimal: true,
    isSpaceOptimal: true,
    personalRubrics: [
      {
        id: "PR_1",
        name: "User Time Complexity",
        description: "Accurately identifies O(n) single-pass two-pointer time complexity.",
        maxPoints: 1.0,
        expectedValue: "O(n)"
      },
      {
        id: "PR_2",
        name: "User Space Complexity",
        description: "Accurately identifies O(1) auxiliary space complexity.",
        maxPoints: 1.0,
        expectedValue: "O(1)"
      },
      {
        id: "PR_3",
        name: "Optimality Recognition",
        description: "Marks isTimeOptimal: true and isSpaceOptimal: true.",
        maxPoints: 1.0,
        expectedValue: true
      },
      {
        id: "PR_4",
        name: "Guidance Null Check",
        description: "Sets guidance to null because both time and space are optimal.",
        maxPoints: 1.0,
        expectedValue: null
      },
      {
        id: "PR_5",
        name: "Detected Topic Tag",
        description: "Identifies 'two-pointers' in userUsed.",
        maxPoints: 1.0,
        expectedValue: ["two-pointers"]
      },
      {
        id: "PR_6",
        name: "Code Quality Grounding",
        description: "Praises O(1) pointer movement and cleanly identifies edge case check.",
        maxPoints: 1.0
      }
    ]
  });

  // 1b. Suboptimal: Dynamic Programming (Prefix & Suffix max arrays) O(n) time, O(n) space
  goldenSolutions.push({
    questionFrontendId: "42",
    title: q42.title,
    difficulty: q42.difficulty,
    body: q42.body,
    constraints: q42.constraints,
    questionAnalysis: {
      crux: "Calculate total trapped rainwater bounded between elevation bars along the 1D profile.",
      optimalTimeComplexity: "O(n)",
      optimalSpaceComplexity: "O(1)",
      allowedTopicSlugs: ["array", "two-pointers", "dynamic-programming", "monotonic-stack"]
    },
    submission: {
      submissionId: "sub_42_subopt",
      language: "Python3",
      code: `class Solution:
    def trap(self, height: list[int]) -> int:
        n = len(height)
        if n == 0:
            return 0
        l_max = [0] * n
        r_max = [0] * n
        l_max[0] = height[0]
        for i in range(1, n):
            l_max[i] = max(l_max[i - 1], height[i])
        r_max[n - 1] = height[n - 1]
        for i in range(n - 2, -1, -1):
            r_max[i] = max(r_max[i + 1], height[i])
        total = 0
        for i in range(n):
            total += min(l_max[i], r_max[i]) - height[i]
        return total`,
      runtimePercentile: 52.1,
      memoryPercentile: 24.8
    }
  });

  solutionRubics.push({
    testCaseId: "42_suboptimal",
    questionFrontendId: "42",
    title: q42.title,
    solutionType: "suboptimal",
    expectedUserUsedTopics: ["dynamic-programming"],
    expectedUserTime: "O(n)",
    expectedUserSpace: "O(n)",
    optimalTime: "O(n)",
    optimalSpace: "O(1)",
    isTimeOptimal: true,
    isSpaceOptimal: false,
    personalRubrics: [
      {
        id: "PR_1",
        name: "User Time Complexity",
        description: "Accurately identifies O(n) linear array scanning time.",
        maxPoints: 1.0,
        expectedValue: "O(n)"
      },
      {
        id: "PR_2",
        name: "User Space Complexity",
        description: "Accurately identifies O(n) auxiliary space due to l_max and r_max lists.",
        maxPoints: 1.0,
        expectedValue: "O(n)"
      },
      {
        id: "PR_3",
        name: "Optimality Recognition",
        description: "Marks isTimeOptimal: true and isSpaceOptimal: false.",
        maxPoints: 1.0,
        expectedValue: false
      },
      {
        id: "PR_4",
        name: "Optimisation Guidance",
        description: "Explains how two-pointer scan reduces auxiliary memory from O(n) to O(1).",
        maxPoints: 1.0
      },
      {
        id: "PR_5",
        name: "Detected Topic Tag",
        description: "Identifies 'dynamic-programming' or 'array' in userUsed.",
        maxPoints: 1.0,
        expectedValue: ["dynamic-programming"]
      },
      {
        id: "PR_6",
        name: "Code Quality Grounding",
        description: "Notes variable naming (l_max, r_max) or redundant passes.",
        maxPoints: 1.0
      }
    ]
  });

  // =========================================================================
  // 2. Q#124: Binary Tree Maximum Path Sum (Hard)
  // =========================================================================
  const q124 = questionMap.get("124")!;

  // 2a. Optimal: Post-order DFS in Python (O(n) time, O(h) space)
  goldenSolutions.push({
    questionFrontendId: "124",
    title: q124.title,
    difficulty: q124.difficulty,
    body: q124.body,
    constraints: q124.constraints,
    questionAnalysis: {
      crux: "Find maximum path sum between any two nodes in a binary tree.",
      optimalTimeComplexity: "O(n)",
      optimalSpaceComplexity: "O(h)",
      allowedTopicSlugs: ["tree", "depth-first-search", "dynamic-programming", "binary-tree"]
    },
    submission: {
      submissionId: "sub_124_opt",
      language: "Python3",
      code: `# Definition for a binary tree node.
# class TreeNode:
#     def __init__(self, val=0, left=None, right=None):
#         self.val = val
#         self.left = left
#         self.right = right
class Solution:
    def maxPathSum(self, root: Optional[TreeNode]) -> int:
        max_sum = float('-inf')
        def max_gain(node):
            nonlocal max_sum
            if not node:
                return 0
            left_gain = max(max_gain(node.left), 0)
            right_gain = max(max_gain(node.right), 0)
            price_newpath = node.val + left_gain + right_gain
            max_sum = max(max_sum, price_newpath)
            return node.val + max(left_gain, right_gain)
        max_gain(root)
        return max_sum`,
      runtimePercentile: 89.2,
      memoryPercentile: 74.0
    }
  });

  solutionRubics.push({
    testCaseId: "124_optimal",
    questionFrontendId: "124",
    title: q124.title,
    solutionType: "optimal",
    expectedUserUsedTopics: ["depth-first-search", "tree"],
    expectedUserTime: "O(n)",
    expectedUserSpace: "O(h)",
    optimalTime: "O(n)",
    optimalSpace: "O(h)",
    isTimeOptimal: true,
    isSpaceOptimal: true,
    personalRubrics: [
      {
        id: "PR_1",
        name: "User Time Complexity",
        description: "Identifies single pass DFS visiting each node once: O(n).",
        maxPoints: 1.0,
        expectedValue: "O(n)"
      },
      {
        id: "PR_2",
        name: "User Space Complexity",
        description: "Identifies recursion call stack space: O(h) or O(n) worst-case.",
        maxPoints: 1.0,
        expectedValue: "O(h)"
      },
      {
        id: "PR_3",
        name: "Optimality Recognition",
        description: "Marks isTimeOptimal: true and isSpaceOptimal: true.",
        maxPoints: 1.0,
        expectedValue: true
      },
      {
        id: "PR_4",
        name: "Guidance Null Check",
        description: "Sets guidance strictly to null.",
        maxPoints: 1.0,
        expectedValue: null
      },
      {
        id: "PR_5",
        name: "Detected Topic Tag",
        description: "Identifies 'depth-first-search' or 'tree' in userUsed.",
        maxPoints: 1.0,
        expectedValue: ["depth-first-search"]
      },
      {
        id: "PR_6",
        name: "Code Quality Grounding",
        description: "Highlights clean negative path pruning with max(gain, 0).",
        maxPoints: 1.0
      }
    ]
  });

  // 2b. Suboptimal: Redundant Subtree Traversal O(n^2) time
  goldenSolutions.push({
    questionFrontendId: "124",
    title: q124.title,
    difficulty: q124.difficulty,
    body: q124.body,
    constraints: q124.constraints,
    questionAnalysis: {
      crux: "Find maximum path sum between any two nodes in a binary tree.",
      optimalTimeComplexity: "O(n)",
      optimalSpaceComplexity: "O(h)",
      allowedTopicSlugs: ["tree", "depth-first-search", "dynamic-programming", "binary-tree"]
    },
    submission: {
      submissionId: "sub_124_subopt",
      language: "Python3",
      code: `class Solution:
    def maxPathSum(self, root: Optional[TreeNode]) -> int:
        def get_branch_max(node):
            if not node:
                return 0
            return node.val + max(0, max(get_branch_max(node.left), get_branch_max(node.right)))

        def traverse(node):
            if not node:
                return float('-inf')
            cur = node.val + max(0, get_branch_max(node.left)) + max(0, get_branch_max(node.right))
            return max(cur, traverse(node.left), traverse(node.right))

        return traverse(root)`,
      runtimePercentile: 12.3,
      memoryPercentile: 30.1
    }
  });

  solutionRubics.push({
    testCaseId: "124_suboptimal",
    questionFrontendId: "124",
    title: q124.title,
    solutionType: "suboptimal",
    expectedUserUsedTopics: ["depth-first-search", "tree"],
    expectedUserTime: "O(n^2)",
    expectedUserSpace: "O(h)",
    optimalTime: "O(n)",
    optimalSpace: "O(h)",
    isTimeOptimal: false,
    isSpaceOptimal: true,
    personalRubrics: [
      {
        id: "PR_1",
        name: "User Time Complexity",
        description: "Accurately identifies O(n^2) time due to recomputing branch max per node.",
        maxPoints: 1.0,
        expectedValue: "O(n^2)"
      },
      {
        id: "PR_2",
        name: "User Space Complexity",
        description: "Identifies recursion call stack depth O(h).",
        maxPoints: 1.0,
        expectedValue: "O(h)"
      },
      {
        id: "PR_3",
        name: "Optimality Recognition",
        description: "Marks isTimeOptimal: false and isSpaceOptimal: true.",
        maxPoints: 1.0,
        expectedValue: false
      },
      {
        id: "PR_4",
        name: "Optimisation Guidance",
        description: "Explains how a bottom-up post-order DFS can compute max path in a single O(n) pass.",
        maxPoints: 1.0
      },
      {
        id: "PR_5",
        name: "Detected Topic Tag",
        description: "Identifies 'depth-first-search' in userUsed.",
        maxPoints: 1.0,
        expectedValue: ["depth-first-search"]
      },
      {
        id: "PR_6",
        name: "Code Quality Grounding",
        description: "Cites get_branch_max and redundant traverse recursion calls.",
        maxPoints: 1.0
      }
    ]
  });

  // =========================================================================
  // 3. Q#329: Longest Increasing Path in a Matrix (Hard)
  // =========================================================================
  const q329 = questionMap.get("329")!;

  // 3a. Optimal: DFS with Memoization O(m * n) time, O(m * n) space
  goldenSolutions.push({
    questionFrontendId: "329",
    title: q329.title,
    difficulty: q329.difficulty,
    body: q329.body,
    constraints: q329.constraints,
    questionAnalysis: {
      crux: "Find length of longest strictly increasing path moving in 4 directions in a matrix.",
      optimalTimeComplexity: "O(m * n)",
      optimalSpaceComplexity: "O(m * n)",
      allowedTopicSlugs: ["array", "dynamic-programming", "depth-first-search", "breadth-first-search", "graph", "topological-sort", "memoization", "matrix"]
    },
    submission: {
      submissionId: "sub_329_opt",
      language: "Python3",
      code: `class Solution:
    def longestIncreasingPath(self, matrix: list[list[int]]) -> int:
        if not matrix or not matrix[0]:
            return 0
        m, n = len(matrix), len(matrix[0])
        memo = {}

        def dfs(r: int, c: int) -> int:
            if (r, c) in memo:
                return memo[(r, c)]
            val = matrix[r][c]
            res = 1
            for dr, dc in [(-1, 0), (1, 0), (0, -1), (0, 1)]:
                nr, nc = r + dr, c + dc
                if 0 <= nr < m and 0 <= nc < n and matrix[nr][nc] > val:
                    res = max(res, 1 + dfs(nr, nc))
            memo[(r, c)] = res
            return res

        return max(dfs(r, c) for r in range(m) for c in range(n))`,
      runtimePercentile: 87.5,
      memoryPercentile: 82.1
    }
  });

  solutionRubics.push({
    testCaseId: "329_optimal",
    questionFrontendId: "329",
    title: q329.title,
    solutionType: "optimal",
    expectedUserUsedTopics: ["depth-first-search", "memoization"],
    expectedUserTime: "O(m * n)",
    expectedUserSpace: "O(m * n)",
    optimalTime: "O(m * n)",
    optimalSpace: "O(m * n)",
    isTimeOptimal: true,
    isSpaceOptimal: true,
    personalRubrics: [
      {
        id: "PR_1",
        name: "User Time Complexity",
        description: "Identifies O(m * n) time due to each cell computed exactly once.",
        maxPoints: 1.0,
        expectedValue: "O(m * n)"
      },
      {
        id: "PR_2",
        name: "User Space Complexity",
        description: "Identifies O(m * n) memoization hash table + call stack.",
        maxPoints: 1.0,
        expectedValue: "O(m * n)"
      },
      {
        id: "PR_3",
        name: "Optimality Recognition",
        description: "Marks isTimeOptimal: true and isSpaceOptimal: true.",
        maxPoints: 1.0,
        expectedValue: true
      },
      {
        id: "PR_4",
        name: "Guidance Null Check",
        description: "Sets guidance to null.",
        maxPoints: 1.0,
        expectedValue: null
      },
      {
        id: "PR_5",
        name: "Detected Topic Tag",
        description: "Identifies 'depth-first-search' and 'memoization' in userUsed.",
        maxPoints: 1.0,
        expectedValue: ["depth-first-search", "memoization"]
      },
      {
        id: "PR_6",
        name: "Code Quality Grounding",
        description: "Praises clean 4-directional loop tuple iteration.",
        maxPoints: 1.0
      }
    ]
  });

  // Write files out
  await fs.writeFile(
    path.resolve(dataDir, "goldenSolutions.json"),
    JSON.stringify(goldenSolutions, null, 2),
    "utf-8"
  );
  await fs.writeFile(
    path.resolve(dataDir, "solutionRubics.json"),
    JSON.stringify(solutionRubics, null, 2),
    "utf-8"
  );

  console.log(`✅ Generated ${goldenSolutions.length} golden solutions in data/goldenSolutions.json`);
  console.log(`✅ Generated ${solutionRubics.length} rubrics in data/solutionRubics.json`);
}

generate().catch(console.error);
