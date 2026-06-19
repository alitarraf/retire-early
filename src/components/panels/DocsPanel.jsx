// Documentation tab — how to use the planner, what to enter, how to read outputs.
import { FIELD_HELP, FIELD_HELP_GROUPS } from "../../constants/fieldHelp.js";

const H2 = ({ children }) => (
  <div style={{ fontSize: 15, fontWeight: 700, color: "#1a2e28", marginTop: 36, marginBottom: 10, paddingBottom: 8, borderBottom: "2px solid #e2e8e6" }}>
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
      <P>Every field below is also a hover tooltip — the ⓘ next to its label in the sidebar shows the same note.</P>
      {FIELD_HELP_GROUPS.map((g) => (
        <div key={g.title}>
          <H3>{g.title}</H3>
          {g.title === "Healthcare & Medicare" && (
            <Callout tone="warn">Only enter the ACA premium if your monthly expenses do NOT already include health insurance — otherwise you'll double-count it.</Callout>
          )}
          {g.ids.map((id) => {
            const f = FIELD_HELP[id];
            if (!f) return null;
            return (
              <Field key={id} name={f.label}>
                {f.context}{f.typical ? ` ${f.typical}` : ""}
              </Field>
            );
          })}
        </div>
      ))}

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
      <P><strong>Outcome range.</strong> Beyond the median we show the <strong>10th percentile</strong> (downside — only 1 in 10 runs ends worse) and the <strong>90th percentile</strong> (upside). The <strong>median estate</strong> is the 50th percentile — the middle outcome, with half of runs above and half below. We rank by final estate rather than depletion age because every run has a final balance ($0 if it ran out), whereas a depletion age only exists for runs that fail. <strong>Show outcome distribution</strong> expands a histogram of all 500 final-estate outcomes — depleted runs pile into the red leftmost bin, and the 10th / median / 90th markers show where you land in the spread.</P>
      <P><strong>Percentile fan on the chart.</strong> The Portfolio-over-time chart overlays a shaded <strong>10th–90th-percentile band</strong> with a <strong>median line</strong> (blue) computed across all 500 runs year by year. The stacked bars are still your single deterministic projection; the fan shows how wide the cone of outcomes gets as sequence risk compounds over time — a band that drops toward $0 in early years is the visual signature of sequence-of-returns risk.</P>
      <P>Returns are heavily right-skewed: a handful of lucky sequences can compound to many multiples of your plan, so the 90th percentile is often far above everything else. To keep the bars readable, the y-axis is anchored to the central outcome (deterministic + median) and capped at 2.5× that; when the 90th percentile runs higher the band clips at the top and the legend notes <em>“90th ↑ off-chart.”</em> The <strong>Show outcome distribution</strong> histogram shows the full upper tail without clipping.</P>
      <P>The gap between the deterministic verdict (above) and the MC success rate is your sequence-of-returns risk. A plan that "works" in the flat-return model might only succeed 80% of the time once timing uncertainty is introduced. In the <strong>Maximize</strong> tab the Monte Carlo runs on demand (a <em>Run Monte Carlo</em> button) so optimizing stays fast; click it to stress-test the recommended strategy.</P>
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

      <H3>Tax transparency, legacy &amp; stress cards</H3>
      <P>Below the headline, both tabs surface three optional cards. <strong>Tax transparency</strong> shows the fraction of your Social Security that is federally taxable in the first year you claim (provisional-income formula, up to 85%) and the effective marginal rate on your first 401k withdrawal — so you can see the tax model at work, not just its output. <strong>Legacy target</strong> (when set) compares your projected estate against your inflated target. <strong>Stress test</strong> (when Scenario Testing is in Stress mode) shows the early-crash downside.</P>

      {/* ── Maximize ── */}
      <H2>Reading the results — Maximize Portfolio tab</H2>

      <H3>Sustainable monthly spend</H3>
      <P>Binary search for the highest monthly expense where money still lasts to life expectancy. This is the maximum you could safely spend if you retired at your configured age.</P>

      <H3>Marginal value of $1,000/yr</H3>
      <P>For each account type, adds $1,000/yr to contributions and measures the increase in estate value at death. Accounts with higher marginal value are where your next savings dollar goes furthest — accounting for taxes, growth, and draw order.</P>

      <H3>Dynamic Roth conversion optimizer</H3>
      <P>Instead of a single fixed annual amount, the optimizer evaluates a multi-year <strong>"fill to the top of the X% bracket each year"</strong> strategy across a window (your retire age through ~72, capturing both the bridge and the years before RMDs begin). For each candidate bracket (10/12/22/24%) it runs the full simulation and keeps the one that maximizes your net estate at life expectancy.</P>
      <P>Filling low brackets while your income is low converts tax-deferred 401k dollars cheaply, grows them tax-free in the Roth, and <strong>shrinks your future Required Minimum Distributions</strong> (which would otherwise be taxed as ordinary income later). The card shows the recommended bracket, the added estate vs. doing nothing, the total converted, the reduction in your 401k at RMD age, and the year-by-year conversion schedule (in nominal future dollars).</P>
      <Callout>
        Conversions are only as large as you can <strong>pay the tax on</strong> from cash then brokerage — a conversion you can't fund is scaled down, so the optimizer never recommends a strategy that depends on phantom tax-free conversions. "Apply these conversions" writes the strategy into your plan; the Strategy section then shows it's active with a one-click way to clear it.
      </Callout>

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
        This is a planning tool, not financial advice. It does not account for: variable income in semi-retirement, Social Security claiming optimization for couples, state tax on all income types (only 401k and brokerage are state-taxed; some states treat income differently), or changes to tax law. One-time large expenses and a declining spending curve <em>can</em> now be modeled via the Advanced inputs. Verify Social Security projections at ssa.gov and tax figures with a CPA before making major decisions.
      </Callout>
      {[
        ["All returns are nominal", "The stock return you enter is the nominal rate (before inflation). Real return = stock return − inflation. Default: 10% − 3% = 7% real."],
        ["SS benefit is in today's dollars", "The engine inflates it each month at the inflation rate. This assumes SS COLA tracks your personal inflation, which is a reasonable approximation."],
        ["ACA subsidy model is simplified", "Below 400% FPL = fully subsidized; above = full premium. The actual ACA subsidy curve is more nuanced and changed with the IRA. Use this as a directional estimate."],
        ["Tax brackets are 2026 IRS figures", "Tax law changes frequently. All brackets are in the constants file and can be updated for any year."],
        ["Spouse SS is treated as a pooled benefit", "The model adds spouse SS income to the household pool at the spouse SS age. Spousal benefit optimization (e.g. file-and-suspend strategies) is not modeled."],
        ["Monte Carlo uses σ=12% annually", "This is a typical equity volatility estimate. Bond-heavy portfolios would have lower standard deviation; your actual sequence of returns will differ."],
        ["Forced RMDs are reinvested, not spent", "When a Required Minimum Distribution is larger than your spending need, the full pre-tax amount is reinvested in your taxable brokerage and the income tax is paid from cash (then brokerage). This models a retiree who doesn't need the RMD to live on — it moves money out of the tax-deferred account but keeps it invested."],
        ["Phase spending & one-time costs are your estimates", "The go-go/slow-go/no-go multipliers and any one-time expenses you enter are illustrative inputs, not predictions. Real spending curves vary widely; use them to pressure-test, not to forecast precisely."],
      ].map(([title, desc]) => (
        <div key={title} style={{ marginBottom: 10, fontSize: 12, color: "#4a5e58", lineHeight: 1.6 }}>
          <strong style={{ color: "#1a2e28" }}>{title}. </strong>{desc}
        </div>
      ))}

    </div>
  );
}
