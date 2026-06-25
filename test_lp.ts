import solver from 'javascript-lp-solver';

console.log('Testing LP Solver for MCPP');

const model: any = {
  optimize: "cost",
  opType: "min",
  constraints: {
    bal_A: { equal: 0 },
    bal_B: { equal: 0 },
    bal_C: { equal: 0 },
    req_AB: { min: 1 },
    req_BC: { min: 1 },
    req_CA: { min: 1 }
  },
  variables: {
    e_AB_fwd: { cost: 1, req_AB: 1, bal_A: -1, bal_B: 1 },
    e_AB_rev: { cost: 1, req_AB: 1, bal_B: -1, bal_A: 1 },
    e_BC_fwd: { cost: 1, req_BC: 1, bal_B: -1, bal_C: 1 },
    e_BC_rev: { cost: 1, req_BC: 1, bal_C: -1, bal_B: 1 },
    e_CA_fwd: { cost: 1, req_CA: 1, bal_C: -1, bal_A: 1 },
    e_CA_rev: { cost: 1, req_CA: 1, bal_A: -1, bal_C: 1 }
  },
  ints: {
    e_AB_fwd: 1, e_AB_rev: 1,
    e_BC_fwd: 1, e_BC_rev: 1,
    e_CA_fwd: 1, e_CA_rev: 1
  }
};

const res = solver.Solve(model);
console.log(res);
