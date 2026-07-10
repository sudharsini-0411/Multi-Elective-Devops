import React from 'react';
import { ChevronRight, Cpu, BookOpen, Layers, CheckCircle2, AlertCircle, HelpCircle } from 'lucide-react';

export default function Home({ onGetStarted }) {
  return (
    <div className="animate-fade-in" style={{ padding: '60px 20px', maxWidth: '1200px', margin: '0 auto', width: '100%' }}>
      {/* Hero Section */}
      <header style={{ textAlign: 'center', marginBottom: '80px' }}>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '6px 16px', borderRadius: '20px', background: 'var(--accent-glow)', border: '1px solid rgba(99, 102, 241, 0.2)', marginBottom: '24px' }}>
          <Layers size={14} style={{ color: 'var(--accent-primary)' }} />
          <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--accent-primary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Academic Fairness Redefined
          </span>
        </div>
        <h1 style={{ fontSize: '3.6rem', fontWeight: 800, lineHeight: 1.1, marginBottom: '20px', letterSpacing: '-0.03em' }}>
          Fair Elective Allocation <br />
          Using <span className="gradient-text">Historical Satisfaction</span>
        </h1>
        <p style={{ fontSize: '1.2rem', color: 'var(--text-secondary)', maxWidth: '750px', margin: '0 auto 32px auto', fontWeight: 400 }}>
          FairElect resolves course allocation conflicts fairly by balancing student preferences with historical satisfaction scores over multiple semesters, preventing chronic allocation starvation.
        </p>
        <div style={{ display: 'flex', justifyContent: 'center', gap: '16px' }}>
          <button onClick={onGetStarted} className="btn-primary" style={{ padding: '14px 32px', fontSize: '1rem' }}>
            Access Portal <ChevronRight size={18} />
          </button>
        </div>
      </header>

      {/* Grid: Problem vs Solution */}
      <section style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '32px', marginBottom: '80px' }}>
        <div className="glass-panel" style={{ padding: '36px' }}>
          <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: 'rgba(239, 68, 68, 0.1)', display: 'flex', alignItems: 'center', justifySelf: 'start', justifyContent: 'center', border: '1px solid rgba(239, 68, 68, 0.2)', marginBottom: '20px' }}>
            <AlertCircle style={{ color: 'var(--error)' }} />
          </div>
          <h3 style={{ fontSize: '1.4rem', fontWeight: 700, marginBottom: '12px' }}>The Starvation Problem</h3>
          <p style={{ color: 'var(--text-secondary)' }}>
            Traditional elective systems use simple bidding points or GPA thresholds. When demand exceeds seat capacity, unlucky students miss their top preferences. Without memory of prior misses, some students repeatedly fail to get their desired courses semester after semester.
          </p>
        </div>
        
        <div className="glass-panel" style={{ padding: '36px' }}>
          <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: 'rgba(16, 185, 129, 0.1)', display: 'flex', alignItems: 'center', justifySelf: 'start', justifyContent: 'center', border: '1px solid rgba(16, 185, 129, 0.2)', marginBottom: '20px' }}>
            <CheckCircle2 style={{ color: 'var(--success)' }} />
          </div>
          <h3 style={{ fontSize: '1.4rem', fontWeight: 700, marginBottom: '12px' }}>The FairElect Solution</h3>
          <p style={{ color: 'var(--text-secondary)' }}>
            By tracking historical satisfaction via a Simple Running Average, the system calculates a fairness score and adjusts a student's priority weight (λ) dynamically. Dissatisfied students get their scores boosted, ensuring long-term allocation equity.
          </p>
        </div>
      </section>

      {/* Algorithmic Blueprint */}
      <section style={{ marginBottom: '80px' }}>
        <h2 style={{ fontSize: '2.2rem', fontWeight: 800, textAlign: 'center', marginBottom: '16px', letterSpacing: '-0.02em' }}>
          Core Mathematical Foundations
        </h2>
        <p style={{ textAlign: 'center', color: 'var(--text-secondary)', maxWidth: '600px', margin: '0 auto 48px auto' }}>
          FairElect combines preference bidding with dynamic historical compensation.
        </p>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '24px' }}>
          {/* PRSM Card */}
          <div className="glass-panel" style={{ padding: '24px' }}>
            <div className="badge badge-info" style={{ marginBottom: '12px' }}>Phase 1: PRSM</div>
            <h4 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '8px' }}>Satisfaction Mapping</h4>
            <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', marginBottom: '16px' }}>
              Maps the allocated choice rank $r$ to current satisfaction.
            </p>
            <div style={{ background: 'rgba(0,0,0,0.2)', padding: '12px', borderRadius: '8px', fontFamily: 'monospace', fontSize: '0.85rem', color: 'var(--accent-primary)', textAlign: 'center' }}>
              S_curr = 1.0 - (r - 1) / N_prefs
            </div>
          </div>

          {/* RAA Card */}
          <div className="glass-panel" style={{ padding: '24px' }}>
            <div className="badge badge-info" style={{ marginBottom: '12px' }}>Phase 2: SRA</div>
            <h4 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '8px' }}>Simple Running Average</h4>
            <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', marginBottom: '16px' }}>
              Averages satisfaction over all allocations (e.g., (100% Prev + 75% Curr) / 2 = 87.5%).
            </p>
            <div style={{ background: 'rgba(0,0,0,0.2)', padding: '12px', borderRadius: '8px', fontFamily: 'monospace', fontSize: '0.85rem', color: 'var(--accent-primary)', textAlign: 'center' }}>
              H_new = (H_prev + S_curr) / 2
            </div>
          </div>

          {/* Dynamic Threshold Card */}
          <div className="glass-panel" style={{ padding: '24px' }}>
            <div className="badge badge-info" style={{ marginBottom: '12px' }}>Phase 3: Threshold</div>
            <h4 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '8px' }}>Dynamic Weight (λ)</h4>
            <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', marginBottom: '16px' }}>
              Calibrates fairness weight dynamically based on threshold $\theta$.
            </p>
            <div style={{ background: 'rgba(0,0,0,0.2)', padding: '12px', borderRadius: '8px', fontFamily: 'monospace', fontSize: '0.85rem', color: 'var(--accent-primary)', textAlign: 'center' }}>
              λ_i = λ_base + γ(θ - H_prev)
            </div>
          </div>

          {/* Priority Score Card */}
          <div className="glass-panel" style={{ padding: '24px' }}>
            <div className="badge badge-info" style={{ marginBottom: '12px' }}>Phase 4: Score</div>
            <h4 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '8px' }}>Heap Allocation Score</h4>
            <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', marginBottom: '16px' }}>
              Raw preference points plus weighted fairness score (FS).
            </p>
            <div style={{ background: 'rgba(0,0,0,0.2)', padding: '12px', borderRadius: '8px', fontFamily: 'monospace', fontSize: '0.85rem', color: 'var(--accent-primary)', textAlign: 'center' }}>
              Score = PP + λ·FS
            </div>
          </div>
        </div>
      </section>

      {/* System Workflow */}
      <section style={{ marginBottom: '60px' }}>
        <h2 style={{ fontSize: '2.2rem', fontWeight: 800, textAlign: 'center', marginBottom: '16px', letterSpacing: '-0.02em' }}>
          Interactive Allocation Workflow
        </h2>
        <p style={{ textAlign: 'center', color: 'var(--text-secondary)', maxWidth: '600px', margin: '0 auto 48px auto' }}>
          The step-by-step logic executed by the backend heap-based engine.
        </p>

        <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', gap: '20px', maxWidth: '800px', margin: '0 auto' }}>
          {/* Connector Line */}
          <div style={{ position: 'absolute', top: '24px', bottom: '24px', left: '27px', width: '2px', background: 'linear-gradient(to bottom, var(--accent-primary), var(--accent-secondary))', zIndex: 0 }}></div>
          
          {[
            { step: '1', title: 'Preference Registration', desc: 'Students register and distribute their 100 points budget across electives.' },
            { step: '2', title: 'Fairness Calibrator', desc: 'The engine pulls student satisfaction histories and determines individual fairness weights (λ).' },
            { step: '3', title: 'Global Priority Matrix', desc: 'Calculates a priority score for all elective bids and constructs a sorted Global Priority Max-Heap.' },
            { step: '4', title: 'Dynamic Heap Processing', desc: 'The engine pops the highest priority pair, updates course seats, recalculates the student satisfaction instantly, and rebuilds the heap dynamically.' },
            { step: '5', title: 'Database Store & Feedback Loop', desc: 'Final allocations are recorded. Recalculated satisfactions carry forward to next semester.' }
          ].map((item, index) => (
            <div key={index} style={{ display: 'flex', gap: '24px', zIndex: 1 }}>
              <div style={{ width: '56px', height: '56px', borderRadius: '50%', background: 'var(--bg-secondary)', border: '2px solid var(--accent-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', fontSize: '1.2rem', color: 'var(--accent-primary)', boxShadow: '0 0 10px rgba(99, 102, 241, 0.2)' }}>
                {item.step}
              </div>
              <div className="glass-panel" style={{ flex: 1, padding: '20px' }}>
                <h4 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '4px' }}>{item.title}</h4>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>{item.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
