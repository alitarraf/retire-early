// Documentation tab — how to use the planner, what to enter, how to read outputs.
const H2 = ({ children }) => (
  <div style={{ fontSize: 15, fontWeight: 700, color: "#1a2e28", marginTop: 36, marginBottom: 10, paddingBottom: 8, borderBottom: "2px solid #dce8e4" }}>
    {children}
  </div>
);
const H3 = ({ children }) => (
  <div style={{ fontSize: 12, fontWeight: 700, color: "#3d8c78", marginTop: 18, marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.08em" }}>
    {children}
  </div>
);
const P = ({ children }) => (
  <p style={{ fontSize: 13, color: "#4a5e58", lineHeight: 1.7, margin: "0 0 10px" }}>{children}</p>
);
const Field = ({ name, children }) => (
  <div style={{ display: "flex", gap: 12, marginBottom: 8, fontSize: 12 }}>
    <div style={{ flex: "0 0 200px", fontWeight: 600, color: "#1a2e28", paddingTop: 1 }}>{name}</div>
    <div style={{ flex: 1, color: "#4a5e58", lineHeight: 1.6 }}>{children}</div>
  </div>
);
const Callout = ({ children, tone = "info" }) => (
  <div style={{
    background: tone === "warn" ? "#fffbf0" : "#f0faf6",
    border: `1px solid ${tone === "warn" ? "#f5d9a0" : "#a3d9c7"}`,
    borderRadius: 10,
    padding: "12px 16px",
    margin: "12px 0",
    fontSize: 12,
    color: tone === "warn" ? "#a06010" : "#2a6e56",
    lineHeight: 1.7,
  }}>
    {children}
  </div>
);
const DrawStep = ({ n, label, detail }) => (
  <div style={{ display: "flex", gap: 12, marginBottom: 8, alignItems: "flex-start" }}>
    <div style={{ flex: "0 0 22px", height: 22, background: "#1a2e28", borderRadius: 99, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 700, color: "#7ecfbb", marginTop: 1 }}>{n}</div>
    <div style={{ fontSize: 12, color: "#4a5e58", lineHeight: 1.6 }}>
      <strong style={{ color: "#1a2e28" }}>{label}</strong>
      {detail && <span style={{ color: "#7C9A92" }}> — {detail}</span>}
    </div>
  </div>
);

export function DocsPanel() {
  return (
    <div style={{ maxWidth: 740, margin: "0 auto", padding: "8px 4px 60px" }}>

      {/* ── Overview ── */}
      <div style={{ background: "#1a2e28", borderRadius: 14, padding: "24px 28px", marginBottom: 8 }}>
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.15em", color: "#7ecfbb", textTransform: "uppercase", marginBottom: 8 }}>How this planner works</div>
        <p style={{ fontSize: 14, color: "#c8e6e0", lineHeight: 1.7, margin: 0 }}>
          This is a tax-aware, month-by-month retirement drawdown simulator. You enter your balances and assumptions
          today; the engine projects them to your retirement date, then simulates spending month by month — applying
          real 2026 tax brackets, Social Security, RMDs, ACA premiums, and your chosen draw order — until the money
          runs out or you reach your life expectancy. All analysis (earliest retire age, optimal Roth conversion,
          Monte Carlo) runs this same simulation repeatedly with varied inputs.
        </p>
      </div>

      {/* ── Two tabs ── */}
      <H2>The two tabs</H2>
      <P>Both tabs share the same sidebar inputs and the same month-by-month simulation engine. The difference is what they solve for.</P>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, margin: "4px 0 16px" }}>
        <div style={{ background: "#fff", border: "2px solid #3d8c78", borderRadius: 12, padding: "16px 18px" }}>
          <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "#3d8c78", marginBottom: 8 }}>Retire Early</div>
          <div style={{ fontSize: 13, fontWeight: 700, color: "#1a2e28", marginBottom: 8 }}>When can I retire?</div>
          <div style={{ fontSize: 12, color: "#4a5e58", lineHeight: 1.6 }}>Retirement age is the <strong>output</strong>. A binary search runs the simulation across ages 30–75 to find the youngest age where money lasts to your life expectancy. Sensitivity rows show which levers move that date. Monte Carlo stress-tests it against 500 randomized return sequences.</div>
        </div>
        <div style={{ background: "#fff", border: "2px solid #1a2e28", borderRadius: 12, padding: "16px 18px" }}>
          <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "#1a2e28", marginBottom: 8 }}>Maximize Portfolio</div>
          <div style={{ fontSize: 13, fontWeight: 700, color: "#1a2e28", marginBottom: 8 }}>How well can I retire?</div>
          <div style={{ fontSize: 12, color: "#4a5e58", lineHeight: 1.6 }}>Retirement age is a <strong>fixed input</strong>. The model solves for sustainable spend, finds the optimal Roth conversion amount, and shows where your next savings dollar does the most good — after taxes, growth, and draw order.</div>
        </div>
      </div>
      <Callout>In practice: use <strong>Retire Early</strong> to find your exit window, then switch to <strong>Maximize</strong> to fine-tune strategy once you've locked in a target age.</Callout>

      {/* ── Getting started ── */}
      <H2>Getting started</H2>
      <P>Fill in the left panel top to bottom. The results update live as you type. The minimum useful set:</P>
      <div style={{ counterReset: "steps" }}>
        {[
          ["Current age + retire target", "Sets the accumulation runway. Everything compounds from today to retire age."],
          ["Monthly expenses (today's $)", "The engine inflates this to your retire date. Include everything except health insurance if you plan to use the ACA premium field."],
          ["Account balances + contributions", "401k, Roth, and any other savings. Employer match is calculated from your salary × match %."],
          ["Social Security age + benefit", "Enter the monthly benefit from your SSA statement, or switch to PIA mode to let the planner compute it based on your claiming age vs. your Full Retirement Age."],
          ["Stock return + inflation", "Defaults: 10% nominal return, 3% inflation = 7% real (inflation-adjusted). These match the S&P 500's long-run historical averages. This is the biggest lever on your projections."],
        ].map(([title, desc], i) => (
          <div key={i} style={{ display: "flex", gap: 14, marginBottom: 12 }}>
            <div style={{ flex: "0 0 26px", height: 26, background: "#3d8c78", borderRadius: 99, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700, color: "#fff", flexShrink: 0, marginTop: 1 }}>{i + 1}</div>
            <div style={{ fontSize: 13, color: "#4a5e58", lineHeight: 1.6 }}>
              <strong style={{ color: "#1a2e28" }}>{title}. </strong>{desc}
            </div>
          </div>
        ))}
      </div>

      {/* ── Inputs ── */}
      <H2>Inputs reference</H2>

      <H3>Who you are / Timeline</H3>
      <Field name="Filing status">Affects federal tax brackets throughout retirement. MFJ brackets are roughly double single brackets.</Field>
      <Field name="Current age">Your age today. All balances compound from now to retire age.</Field>
      <Field name="Household size">Used for the ACA Federal Poverty Level calculation. Affects whether you owe the full ACA premium or qualify for subsidies.</Field>
      <Field name="Retire at">The age you plan to stop working. The engine finds your earliest viable age separately — set this to your target.</Field>
      <Field name="Your Social Security at">The age you claim SS (62–70). Earlier = permanently lower benefit; later = permanently higher. Use PIA mode to see the exact trade-off.</Field>
      <Field name="Life expectancy">The simulation runs to this age. Money lasting to here = success. Use 90–95 to stress-test longevity.</Field>

      <H3>Spending & Social Security</H3>
      <Field name="Monthly expenses (today's $)">Your current monthly spend. The engine inflates this at your inflation rate to the retire date and beyond. Do not include health insurance if you're using the ACA premium field.</Field>
      <Field name="SS benefit (direct)">Monthly amount from your SSA statement at your chosen claiming age, in today's dollars. The engine inflates it in retirement.</Field>
      <Field name="PIA mode">Enter your Primary Insurance Amount (the benefit at your Full Retirement Age from your SSA statement) and your FRA. The planner computes your actual benefit based on how early or late you claim. Claiming at 62 with FRA 67 = ~70% of PIA; at 70 = ~124%.</Field>

      <H3>Accounts</H3>
      <Field name="401k balance + contribution">Current balance + annual you + employer match (salary × match %). Both compound to retire age at the stock return. Withdrawals in retirement are taxed as ordinary income.</Field>
      <Field name="Roth IRA">Split your existing balance into contributions (always withdrawable tax-free) and earnings (free after 59½). Future contributions compound tax-free.</Field>
      <Field name="CD / cash deposit">After-tax savings in high-yield accounts. Grows at the CD rate (after tax during accumulation). First bucket drawn in early retirement after Roth contributions.</Field>
      <Field name="Municipal bonds">Tax-free (or state-only-taxable) bond income. Grows at the muni yield. Drawn before brokerage but after Roth contributions in the draw order.</Field>
      <Field name="Taxable brokerage">Only the gain above your cost basis is taxed at your long-term capital gains rate when sold. Enter basis separately for accurate tax modeling.</Field>
      <Field name="HSA">Grows at the stock return, tax-free. Draws are tax-free for medical expenses (the model assumes all retirement HSA draws are qualified). Sits between munis and brokerage in the draw order — more efficient than either.</Field>

      <H3>Healthcare & Medicare</H3>
      <Callout tone="warn">Only enter the ACA premium if your monthly expenses do NOT already include health insurance — otherwise you'll double-count it.</Callout>
      <Field name="ACA full premium">Unsubsidized monthly marketplace premium (ages 55–64). Added to expenses only when your income exceeds ~$66k/yr (400% FPL for 2 people). Below that, subsidies are assumed to cover it. At 65, Medicare replaces ACA and this cost stops.</Field>
      <Field name="IRMAA surcharge">Medicare Part B+D surcharge at 65+ for higher-income retirees. Based on income from 2 years prior. Standard Part B (~$185/mo) is assumed baked into your monthly expenses; enter only the surcharge above that.</Field>
      <Field name="State SS exemption">Many states (e.g. Oregon partially, Illinois fully) don't tax Social Security income. None / 50% / Full reduces the state tax applied to your SS benefit.</Field>

      <H3>Assumptions</H3>
      <Field name="Stock market return">Nominal annual return — before subtracting inflation. Everything (401k, Roth, brokerage, HSA) grows at this rate. Your real (inflation-adjusted) return is this minus the inflation rate below. Default: 10% nominal − 3% inflation = 7% real, which matches the S&P 500's long-run historical average.</Field>
      <Field name="Inflation rate">Applied to expenses each month in retirement. Also inflates Social Security (SS is CPI-adjusted). 4.2% = recent 5-year average; 3% = long-run historical average.</Field>
      <Field name="CD / deposit rate">Rate on cash savings during accumulation only (pre-retire). Taxed at your employment bracket. In retirement, CD is treated as regular cash.</Field>

      <H3>Tax & Strategy</H3>
      <Field name="Employment bracket">Your marginal federal bracket while working. Used only for taxing CD interest during accumulation — not for retirement withdrawals.</Field>
      <Field name="Long-term cap gains">Your LTCG rate on brokerage gains (0%, 15%, or 20%). State tax is added on top.</Field>
      <Field name="State income tax">State rate applied to 401k withdrawals and brokerage gains in retirement. Toggle off if you'll move to a no-income-tax state.</Field>
      <Field name="Roth conversion ladder">Convert this much per year from 401k → Roth during the bridge (retire age → 59½) while your income is low. Taxed now; unlocks tax-free after 5 years. The optimal amount is computed automatically in the Maximize tab.</Field>
      <Field name="Rule of 55">If you left your employer at 55 or older, you can take 401k withdrawals before 59½ without the 10% penalty. This eliminates the need for a Roth ladder if the 401k is large enough.</Field>
      <Field name="72(t) SEPP">Substantially Equal Periodic Payments — commit to a fixed annual 401k draw for 5 years or until 59½ (whichever is longer). Useful when Rule of 55 doesn't apply and you don't have enough Roth contributions to bridge the gap.</Field>
      <Field name="Spending guardrails">Guyton-Klinger dynamic spending. Upper guardrail: if your portfolio withdrawal rate exceeds the threshold, spending is cut 10% for the next year. Lower guardrail: if WR drops below the threshold (portfolio growing fast), spending is raised 10%. WR is calculated as net portfolio draw (spend minus SS) ÷ total portfolio. Typical: upper 5–6%, lower 3%.</Field>

      {/* ── Outputs ── */}
      <H2>Reading the results — Retire Early tab</H2>

      <H3>Earliest you can retire</H3>
      <P>Binary search over ages 40–75. At each age the full simulation runs; the earliest age where money lasts to your life expectancy is returned. If your target retire age is at or above this number, you're on track.</P>

      <H3>Verdict</H3>
      <P>Does retiring at your configured age survive to life expectancy? Green = yes; red = runs out. When red, the depletion age shown is when all accessible funds (including the unlocked 401k) hit zero.</P>
      <P>Bridge shortfall warning appears when there are months before 59½ where your accessible funds (Roth contributions, munis, brokerage, CD) couldn't cover expenses, but the 401k still had money. This means you need more bridge assets — increase munis, brokerage, or use the Roth ladder.</P>

      <H3>Sensitivity levers</H3>
      <P>Each row changes one variable and re-runs the full simulation. The delta is how many years earlier you could retire. Use this to see which levers matter most for your situation.</P>

      <H3>Monte Carlo — 500 scenarios</H3>
      <P>Runs 500 simulations, each with the same mean return but randomized year-by-year sequence. A crash at 57 has a very different impact than one at 75, even if the lifetime average return is identical. This is sequence-of-returns risk.</P>
      <P><strong>Success rate</strong> = fraction of 500 runs where money lasts to life expectancy. 90%+ is green; 75–89% is orange; below 75% is red.</P>
      <P><strong>Median estate</strong> = the middle outcome across all 500 runs. Half of scenarios leave more than this, half leave less.</P>
      <P>The gap between the deterministic verdict (above) and the MC success rate is your sequence-of-returns risk. A plan that "works" in the flat-return model might only succeed 80% of the time once timing uncertainty is introduced.</P>
      <Callout>Higher return assumption → higher success rate. This is correct: a higher mean return shifts the entire distribution of outcomes upward. Monte Carlo models uncertainty around your assumption, not a different assumption.</Callout>

      <H3>Phase breakdown</H3>
      <P>Three phases with different tax and access rules:</P>
      {[
        ["Bridge (retire → 59½)", "401k is locked (unless Rule of 55 or SEPP). Draw from: Roth contributions → munis → HSA → brokerage → CD. Roth earnings locked until 59½."],
        ["Early retirement (59½ → SS age)", "401k unlocked. Roth earnings now free. 401k withdrawals taxed at retirement brackets (usually much lower than your working rate)."],
        ["Full SS (SS age → life expectancy)", "Social Security offsets a chunk of expenses. Portfolio draw rate drops. RMDs may kick in at 73 or 75 (depends on birth year)."],
      ].map(([phase, desc]) => (
        <div key={phase} style={{ marginBottom: 10, paddingLeft: 12, borderLeft: "3px solid #3d8c78", fontSize: 12, color: "#4a5e58", lineHeight: 1.6 }}>
          <strong style={{ color: "#1a2e28", display: "block", marginBottom: 2 }}>{phase}</strong>
          {desc}
        </div>
      ))}

      {/* ── Maximize ── */}
      <H2>Reading the results — Maximize Portfolio tab</H2>

      <H3>Sustainable monthly spend</H3>
      <P>Binary search for the highest monthly expense where money still lasts to life expectancy. This is the maximum you could safely spend if you retired at your configured age.</P>

      <H3>Marginal value of $1,000/yr</H3>
      <P>For each account type, adds $1,000/yr to contributions and measures the increase in estate value at death. Accounts with higher marginal value are where your next savings dollar goes furthest — accounting for taxes, growth, and draw order.</P>

      <H3>Optimal Roth conversion</H3>
      <P>Tests every $5k annual conversion amount from $0 to $60k during the bridge, runs the full simulation for each, and picks the amount that maximizes estate value. A conversion is only recommended if it improves the estate — if the tax cost today outweighs the long-term benefit, the recommendation is $0.</P>

      {/* ── Engine ── */}
      <H2>How the simulation engine works</H2>

      <P>The simulation runs month by month from retire age to life expectancy. Each month:</P>
      <div style={{ marginBottom: 16, marginTop: 4 }}>
        {[
          ["All balances grow", "Every account (401k, Roth, brokerage, munis, HSA, CD) grows at the monthly equivalent of the stock return."],
          ["Social Security kicks in at SS age", "Inflated by inflation each month. Up to 85% is taxable federally; state exemption reduces state tax on SS."],
          ["ACA premium applied (pre-65)", "Added to expenses when prior-year income exceeded the FPL cliff."],
          ["IRMAA applied (65+)", "Medicare surcharge added to expenses."],
          ["Expenses are covered in draw order", "See below."],
          ["Guardrails checked at year-end", "WR = (spend − SS) × 12 ÷ portfolio. Cut 10% if above upper; raise 10% if below lower."],
          ["RMD forced at year-end (73 or 75)", "Minimum 401k draw, net of tax, moves to brokerage if not already withdrawn."],
        ].map(([label, desc], i) => (
          <DrawStep key={i} n={i + 1} label={label} detail={desc} />
        ))}
      </div>

      <H3>Draw order</H3>
      <P>When expenses exceed Social Security income, the shortfall is covered from accounts in this order:</P>
      <div style={{ marginTop: 8 }}>
        {[
          ["Roth contributions", "Always tax-free, no age restriction. Drawn first."],
          ["Roth earnings (59½+)", "Tax-free after 59½. Locked before."],
          ["Converted Roth (59½+ AND 5-yr lock cleared)", "Conversions must be 5 years old and you must be 59½."],
          ["Municipal bonds", "Tax-free income (or state-only taxable). Efficient bridge asset."],
          ["HSA", "Tax-free draws (assumed qualified medical). More efficient than brokerage."],
          ["Taxable brokerage", "Only gain above cost basis is taxed at LTCG rate."],
          ["401k (59½+, or Rule of 55 / SEPP)", "Taxed as ordinary income at retirement brackets."],
          ["CD / cash", "Drawn last. Taxed as ordinary income on any gains."],
        ].map(([label, detail], i) => (
          <DrawStep key={i} n={i + 1} label={label} detail={detail} />
        ))}
      </div>

      {/* ── Caveats ── */}
      <H2>Limitations & assumptions</H2>
      <Callout tone="warn">
        This is a planning tool, not financial advice. It does not account for: one-time large expenses (weddings, medical, home repairs), variable income in semi-retirement, Social Security claiming optimization for couples, state tax on all income types (only 401k and brokerage are state-taxed; some states treat income differently), or changes to tax law. Verify Social Security projections at ssa.gov and tax figures with a CPA before making major decisions.
      </Callout>
      {[
        ["All returns are nominal", "The stock return you enter is the nominal rate (before inflation). Real return = stock return − inflation. Default: 10% − 3% = 7% real."],
        ["SS benefit is in today's dollars", "The engine inflates it each month at the inflation rate. This assumes SS COLA tracks your personal inflation, which is a reasonable approximation."],
        ["ACA subsidy model is simplified", "Below 400% FPL = fully subsidized; above = full premium. The actual ACA subsidy curve is more nuanced and changed with the IRA. Use this as a directional estimate."],
        ["Tax brackets are 2026 IRS figures", "Tax law changes frequently. All brackets are in the constants file and can be updated for any year."],
        ["Spouse SS is treated as a pooled benefit", "The model adds spouse SS income to the household pool at the spouse SS age. Spousal benefit optimization (e.g. file-and-suspend strategies) is not modeled."],
        ["Monte Carlo uses σ=12% annually", "This is a typical equity volatility estimate. Bond-heavy portfolios would have lower standard deviation; your actual sequence of returns will differ."],
      ].map(([title, desc]) => (
        <div key={title} style={{ marginBottom: 10, fontSize: 12, color: "#4a5e58", lineHeight: 1.6 }}>
          <strong style={{ color: "#1a2e28" }}>{title}. </strong>{desc}
        </div>
      ))}

    </div>
  );
}
