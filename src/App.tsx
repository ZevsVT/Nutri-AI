import { useEffect, useMemo, useRef, useState } from "react";
import type { ChangeEvent, FormEvent, ReactNode, RefObject } from "react";
import { detectedItems as initialDetectedItems, meals as initialMeals, recipes } from "./data";
import { Icon, type IconName } from "./icons";
import type { ChatMessage, DetectedItem, Meal, MealType, Recipe, View } from "./types";

const primaryNav: { id: View; label: string; icon: IconName }[] = [
  { id: "dashboard", label: "Dashboard", icon: "home" },
  { id: "analyze", label: "Analyze meal", icon: "scan" },
  { id: "diary", label: "Food diary", icon: "book" },
  { id: "insights", label: "Insights", icon: "chart" },
  { id: "assistant", label: "AI assistant", icon: "sparkles" },
  { id: "recipes", label: "Recipes", icon: "recipe" },
];

const bottomNav: { id: View; label: string; icon: IconName }[] = [
  { id: "dashboard", label: "Home", icon: "home" },
  { id: "analyze", label: "Analyze", icon: "scan" },
  { id: "diary", label: "Diary", icon: "book" },
  { id: "assistant", label: "AI", icon: "sparkles" },
  { id: "profile", label: "Profile", icon: "user" },
];

const dailyTotals = {
  calories: 1190,
  protein: 67,
  carbs: 122,
  fat: 37,
  fiber: 16,
  water: 1250,
};

const analysisNutrition = {
  calories: 560,
  protein: 28,
  carbs: 52,
  fat: 14,
  fiber: 5,
  sodium: 1100,
};

const assistantStarterMessages: ChatMessage[] = [
  {
    id: "welcome",
    role: "assistant",
    content: "Hi Thanh! I can help you make sense of your meals using the foods you’ve logged today. What are you curious about?",
    meta: "Grounded in your diary",
  },
];

function App() {
  const [activeView, setActiveView] = useState<View>("dashboard");
  const [meals, setMeals] = useState<Meal[]>(initialMeals);
  const [analysisStage, setAnalysisStage] = useState<"capture" | "processing" | "review" | "result">("capture");
  const [analysisPreview, setAnalysisPreview] = useState<string | null>(null);
  const [detected, setDetected] = useState<DetectedItem[]>(initialDetectedItems);
  const [mealSaved, setMealSaved] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [globalSearch, setGlobalSearch] = useState("");
  const [assistantMessages, setAssistantMessages] = useState(assistantStarterMessages);
  const [assistantInput, setAssistantInput] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!toast) return;
    const timeout = window.setTimeout(() => setToast(null), 3200);
    return () => window.clearTimeout(timeout);
  }, [toast]);

  const navigate = (view: View) => {
    setActiveView(view);
    setNotificationsOpen(false);
  };

  const startAnalysis = () => {
    navigate("analyze");
    setAnalysisStage("processing");
    setMealSaved(false);
    window.setTimeout(() => setAnalysisStage("review"), 1100);
  };

  const handleFile = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const url = URL.createObjectURL(file);
    setAnalysisPreview(url);
    setAnalysisStage("processing");
    setMealSaved(false);
    window.setTimeout(() => setAnalysisStage("review"), 1100);
  };

  const confirmAnalysis = () => {
    setAnalysisStage("result");
    setToast("Nutrition estimate ready to review");
  };

  const saveAnalyzedMeal = () => {
    if (mealSaved) return;
    const savedMeal: Meal = {
      id: "analyzed-pho",
      type: "Dinner",
      name: "Phở bò",
      description: "Beef · rice noodles · herbs · broth",
      time: "Just now",
      art: analysisPreview ? "meal-art--uploaded" : "meal-art--pho",
      image: analysisPreview ?? "/images/pho-bo.jpg",
      calories: analysisNutrition.calories,
      protein: analysisNutrition.protein,
      carbs: analysisNutrition.carbs,
      fat: analysisNutrition.fat,
      fiber: analysisNutrition.fiber,
      confidence: 0.87,
      portion: "1 medium bowl",
      tags: ["Analyzed", "Vietnamese"],
    };
    setMeals((current) => [savedMeal, ...current.filter((meal) => meal.id !== savedMeal.id)]);
    setMealSaved(true);
    setToast("Meal saved to your diary");
  };

  const sendAssistantMessage = (event?: FormEvent) => {
    event?.preventDefault();
    const message = assistantInput.trim();
    if (!message) return;
    setAssistantMessages((current) => [
      ...current,
      { id: `user-${Date.now()}`, role: "user", content: message },
      {
        id: `assistant-${Date.now()}`,
        role: "assistant",
        content: message.toLowerCase().includes("fiber")
          ? "Fiber helps support digestion and keeps meals satisfying. You’re at 16 g so far today; adding fruit, beans, or another serving of vegetables would be a practical next step. This is a habit suggestion, not a medical target.": "Based on today’s diary, your meals already include several protein sources. For your next meal, consider adding a colorful vegetable or fruit to build variety. The exact nutrition will depend on the portion and recipe.",
        meta: "Based on today’s logged meals",
      },
    ]);
    setAssistantInput("");
  };

  const removeDetectedItem = (id: string) => {
    setDetected((items) => items.filter((item) => item.id !== id));
  };

  const pageTitle = primaryNav.find((item) => item.id === activeView)?.label ?? "Profile";

  return (
    <div className="app-shell">
      <Sidebar activeView={activeView} navigate={navigate} />
      <div className="app-main">
        <TopBar
          title={pageTitle}
          search={globalSearch}
          onSearchChange={setGlobalSearch}
          onSearch={() => navigate("diary")}
          notificationsOpen={notificationsOpen}
          setNotificationsOpen={setNotificationsOpen}
          navigate={navigate}
        />
        <main className="page-content">
          {activeView === "dashboard" && <DashboardView meals={meals} onAnalyze={startAnalysis} navigate={navigate} />}
          {activeView === "analyze" && (
            <AnalyzeView
              stage={analysisStage}
              preview={analysisPreview}
              detected={detected}
              fileInputRef={fileInputRef}
              onFile={handleFile}
              onDemo={startAnalysis}
              onRemove={removeDetectedItem}
              onConfirm={confirmAnalysis}
              onSave={saveAnalyzedMeal}
              saved={mealSaved}
              onReset={() => {
                setAnalysisStage("capture");
                setAnalysisPreview(null);
                setDetected(initialDetectedItems);
              }}
            />
          )}
          {activeView === "diary" && <DiaryView meals={meals} initialSearch={globalSearch} />}
          {activeView === "insights" && <InsightsView />}
          {activeView === "assistant" && (
            <AssistantView messages={assistantMessages} input={assistantInput} setInput={setAssistantInput} onSend={sendAssistantMessage} />
          )}
          {activeView === "recipes" && <RecipesView />}
          {activeView === "profile" && <ProfileView />}
        </main>
      </div>
      <BottomNav activeView={activeView} navigate={navigate} />
      {toast && <div className="toast"><span className="toast-check"><Icon name="check" size={15} /></span>{toast}</div>}
    </div>
  );
}

function BrandMark() {
  return <div className="brand-mark"><Icon name="leaf" size={19} strokeWidth={2.2} /></div>;
}

function Sidebar({ activeView, navigate }: { activeView: View; navigate: (view: View) => void }) {
  return (
    <aside className="sidebar">
      <div className="brand"><BrandMark /><span>Nutri<span className="brand-accent">AI</span></span></div>
      <div className="workspace-pill"><span className="avatar avatar--small">T</span><span>Thanh’s workspace</span><Icon name="chevron" size={14} /></div>
      <nav className="sidebar-nav" aria-label="Primary navigation">
        <p className="nav-label">Workspace</p>
        {primaryNav.map((item) => (
          <button key={item.id} type="button" className={`nav-item ${activeView === item.id ? "nav-item--active" : ""}`} onClick={() => navigate(item.id)}>
            <Icon name={item.icon} size={19} />
            <span>{item.label}</span>
            {item.id === "assistant" && <span className="new-dot">New</span>}
          </button>
        ))}
      </nav>
      <div className="sidebar-bottom">
        <div className="privacy-note"><Icon name="shield" size={16} /><span>Your data stays private</span></div>
        <button type="button" className={`nav-item ${activeView === "profile" ? "nav-item--active" : ""}`} onClick={() => navigate("profile")}><Icon name="settings" size={19} /><span>Settings</span></button>
        <button type="button" className="profile-card" onClick={() => navigate("profile")}><span className="avatar">T</span><span className="profile-copy"><strong>Thanh Nguyen</strong><small>Personal account</small></span><Icon name="more" size={18} /></button>
      </div>
    </aside>
  );
}

function TopBar({ title, search, onSearchChange, onSearch, notificationsOpen, setNotificationsOpen, navigate }: { title: string; search: string; onSearchChange: (value: string) => void; onSearch: () => void; notificationsOpen: boolean; setNotificationsOpen: (open: boolean) => void; navigate: (view: View) => void }) {
  return (
    <header className="topbar">
      <div className="topbar-title"><button type="button" className="mobile-menu" aria-label="Open menu"><Icon name="menu" size={20} /></button><span className="eyebrow">Saturday, August 22</span><h1>{title}</h1></div>
      <div className="topbar-actions">
        <form className="global-search" onSubmit={(event) => { event.preventDefault(); if (search.trim()) onSearch(); }}>
          <Icon name="search" size={17} /><input aria-label="Search meals and foods" value={search} onChange={(event) => onSearchChange(event.target.value)} placeholder="Search your diary..." /><kbd>⌘ K</kbd>
        </form>
        <div className="notification-wrap">
          <button type="button" className="icon-button notification-button" aria-label="Notifications" onClick={() => setNotificationsOpen(!notificationsOpen)}><Icon name="bell" size={19} /><span className="notification-badge">2</span></button>
          {notificationsOpen && <div className="notification-popover"><div className="popover-head"><strong>Notifications</strong><span>2 new</span></div><div className="notification-line"><span className="notification-icon notification-icon--green"><Icon name="check" size={15} /></span><p><strong>Meal saved</strong><small>Your phở bò analysis is in the diary.</small></p></div><div className="notification-line"><span className="notification-icon notification-icon--amber"><Icon name="sparkles" size={15} /></span><p><strong>New insight</strong><small>You logged 4 different plant foods.</small></p></div><button type="button" className="text-button" onClick={() => navigate("insights")}>View all insights <Icon name="arrow" size={14} /></button></div>}
        </div>
        <button type="button" className="top-avatar" onClick={() => navigate("profile")}>T</button>
      </div>
    </header>
  );
}

function BottomNav({ activeView, navigate }: { activeView: View; navigate: (view: View) => void }) {
  return <nav className="bottom-nav" aria-label="Mobile navigation">{bottomNav.map((item) => <button type="button" key={item.id} className={activeView === item.id ? "bottom-nav__item--active" : ""} onClick={() => navigate(item.id)}><Icon name={item.icon} size={20} /><span>{item.label}</span></button>)}</nav>;
}

function DashboardView({ meals, onAnalyze, navigate }: { meals: Meal[]; onAnalyze: () => void; navigate: (view: View) => void }) {
  return (
    <div className="view view--dashboard">
      <section className="welcome-row"><div><p className="section-kicker">Your nutrition, made clearer</p><h2>Good morning, Thanh <span className="wave">✦</span></h2><p className="muted-copy">A little context goes a long way. Here’s your day so far.</p></div><div className="date-picker"><span className="date-picker__dot" /><span>Today, Aug 22</span><Icon name="chevron" size={15} /></div></section>
      <section className="dashboard-hero">
        <div className="hero-copy"><span className="soft-badge"><Icon name="sparkles" size={14} /> Daily snapshot</span><h3>Make your next meal<br /><em>count for more.</em></h3><p>You’re building a nice rhythm today. Add one more colorful plant food to round things out.</p><button type="button" className="primary-button" onClick={onAnalyze}>Analyze a meal <Icon name="arrow" size={16} /></button></div>
        <div className="hero-visual"><div className="hero-orbit hero-orbit--one" /><div className="hero-orbit hero-orbit--two" /><div className="hero-plate"><img src="/images/chicken-bowl.jpg" alt="Chicken, rice and vegetables in a bowl" /></div><div className="floating-insight"><span className="floating-insight__icon"><Icon name="leaf" size={15} /></span><span><strong>Plant variety</strong><small>4 foods today</small></span></div><div className="floating-confidence"><Icon name="check" size={14} /> On track</div></div>
      </section>
      <section className="metric-grid" aria-label="Today's nutrition overview">
        <MetricCard icon="utensils" label="Meals logged" value="3" suffix="of 4" tone="lavender" progress={75} note="Nice consistency" />
        <MetricCard icon="flame" label="Protein" value={`${dailyTotals.protein}`} suffix="g" tone="peach" progress={74} note="A strong start" />
        <MetricCard icon="leaf" label="Fiber" value={`${dailyTotals.fiber}`} suffix="g" tone="mint" progress={64} note="Add fruit later" />
        <MetricCard icon="water" label="Water" value={`${(dailyTotals.water / 1000).toFixed(1)}`} suffix="L" tone="blue" progress={52} note="2 more glasses" />
      </section>
      <div className="content-grid">
        <section className="panel meals-panel"><div className="panel-heading"><div><p className="section-kicker">Your day</p><h3>Today’s meals</h3></div><button type="button" className="link-button" onClick={() => navigate("diary")}>View diary <Icon name="arrow" size={14} /></button></div><div className="meal-list">{meals.slice(0, 3).map((meal) => <MealCard key={meal.id} meal={meal} />)}<button type="button" className="add-meal-row" onClick={onAnalyze}><span><Icon name="plus" size={17} /></span><strong>Log another meal</strong><small>Photo, text, or search</small><Icon name="arrow" size={16} /></button></div></section>
        <aside className="side-stack"><InsightCard /><div className="mini-panel"><div className="panel-heading"><div><p className="section-kicker">Quick add</p><h3>Small habits</h3></div><Icon name="more" size={18} /></div><div className="habit-row"><span className="habit-icon habit-icon--water"><Icon name="water" size={17} /></span><span><strong>Water</strong><small>{dailyTotals.water} / 2400 ml</small></span><button type="button" className="round-add" aria-label="Add water"><Icon name="plus" size={16} /></button></div><div className="habit-row"><span className="habit-icon habit-icon--leaf"><Icon name="leaf" size={17} /></span><span><strong>Plant variety</strong><small>4 food groups today</small></span><span className="habit-check"><Icon name="check" size={15} /></span></div></div></aside>
      </div>
    </div>
  );
}

function MetricCard({ icon, label, value, suffix, tone, progress, note }: { icon: IconName; label: string; value: string; suffix: string; tone: string; progress: number; note: string }) {
  return <article className="metric-card"><div className={`metric-icon metric-icon--${tone}`}><Icon name={icon} size={18} /></div><div className="metric-copy"><span>{label}</span><div><strong>{value}</strong><small>{suffix}</small></div><p>{note}</p></div><div className="metric-progress"><span style={{ width: `${progress}%` }} /></div></article>;
}

function MealCard({ meal, compact = false }: { meal: Meal; compact?: boolean }) {
  return <article className={`meal-card ${compact ? "meal-card--compact" : ""}`}><div className={`meal-art ${meal.art}`}><img src={meal.image} alt="" loading="lazy" /></div><div className="meal-card__body"><div className="meal-card__top"><span className="meal-type">{meal.type}</span><span className="meal-time"><Icon name="clock" size={13} /> {meal.time}</span></div><h4>{meal.name}</h4><p>{meal.description}</p><div className="meal-meta"><span>{meal.calories} kcal</span><span className="meal-meta__dot" /><span>{meal.protein} g protein</span><span className="confidence-pill"><span className="confidence-dot" />{Math.round(meal.confidence * 100)}%</span></div></div><button type="button" className="more-button" aria-label={`More options for ${meal.name}`}><Icon name="more" size={18} /></button></article>;
}

function InsightCard() {
  return <div className="insight-card"><div className="insight-card__glow" /><div className="insight-header"><span className="insight-icon"><Icon name="sparkles" size={16} /></span><span className="insight-label">NUTRIAI INSIGHT</span><span className="insight-time">Just now</span></div><h3>A colorful next step</h3><p>You’ve had protein at every meal today. Try adding a fruit or vegetable to your next plate for more variety.</p><button type="button" className="insight-link">Why this matters <Icon name="arrow" size={14} /></button></div>;
}

function AnalyzeView({ stage, preview, detected, fileInputRef, onFile, onDemo, onRemove, onConfirm, onSave, saved, onReset }: { stage: "capture" | "processing" | "review" | "result"; preview: string | null; detected: DetectedItem[]; fileInputRef: RefObject<HTMLInputElement | null>; onFile: (event: ChangeEvent<HTMLInputElement>) => void; onDemo: () => void; onRemove: (id: string) => void; onConfirm: () => void; onSave: () => void; saved: boolean; onReset: () => void }) {
  return <div className="view view--analyze"><section className="view-heading"><div><p className="section-kicker">Your fastest path to clarity</p><h2>Analyze a meal</h2><p className="muted-copy">Capture what’s on your plate. We’ll help you understand it.</p></div><span className="estimate-note"><Icon name="shield" size={15} /> Estimates are always labeled</span></section><div className="analysis-steps"><Step number="01" label="Capture" active={stage === "capture" || stage === "processing"} done={stage === "review" || stage === "result"} /><Step number="02" label="Review" active={stage === "review"} done={stage === "result"} /><Step number="03" label="Understand" active={stage === "result"} done={false} /></div>{stage === "capture" && <CaptureState fileInputRef={fileInputRef} onFile={onFile} onDemo={onDemo} />}{stage === "processing" && <ProcessingState preview={preview} />}{stage === "review" && <ReviewState preview={preview} detected={detected} onRemove={onRemove} onConfirm={onConfirm} />}{stage === "result" && <ResultState preview={preview} onSave={onSave} saved={saved} onReset={onReset} />}</div>;
}

function Step({ number, label, active, done }: { number: string; label: string; active: boolean; done: boolean }) {
  return <div className={`analysis-step ${active ? "analysis-step--active" : ""} ${done ? "analysis-step--done" : ""}`}><span>{done ? <Icon name="check" size={14} /> : number}</span><strong>{label}</strong></div>;
}

function CaptureState({ fileInputRef, onFile, onDemo }: { fileInputRef: RefObject<HTMLInputElement | null>; onFile: (event: ChangeEvent<HTMLInputElement>) => void; onDemo: () => void }) {
  return <div className="capture-grid"><div className="capture-card"><div className="capture-card__top"><span className="capture-card__eyebrow"><span className="pulse-dot" /> AI meal analysis</span><span className="capture-card__time">~ 10 sec</span></div><div className="upload-zone"><div className="upload-icon"><Icon name="camera" size={26} /></div><h3>What’s on your plate?</h3><p>Upload a photo or take one now.<br />You can also describe your meal in words.</p><div className="upload-actions"><button type="button" className="primary-button" onClick={() => fileInputRef.current?.click()}><Icon name="upload" size={16} /> Upload photo</button><button type="button" className="secondary-button" onClick={onDemo}><Icon name="sparkles" size={16} /> Try demo meal</button></div><input ref={fileInputRef} type="file" accept="image/*" onChange={onFile} hidden /><span className="upload-hint">JPG, PNG up to 10 MB · Your photo stays private</span></div><div className="capture-footer"><button type="button" className="text-button"><Icon name="edit" size={15} /> Type a meal instead</button><span>or</span><button type="button" className="text-button"><Icon name="book" size={15} /> Search food database</button></div></div><div className="capture-aside"><div className="how-card"><div className="how-card__heading"><span className="number-orb">✦</span><h3>What NutriAI looks for</h3></div><HowItem icon="scan" title="Recognize" text="Foods, ingredients, and cooking method" /><HowItem icon="chart" title="Estimate" text="Portion size and key nutrients" /><HowItem icon="sparkles" title="Explain" text="A simple, practical next step" /></div><div className="privacy-card"><Icon name="shield" size={18} /><div><strong>Built for trust</strong><p>We show confidence and sources, so you stay in control.</p></div></div></div></div>;
}

function HowItem({ icon, title, text }: { icon: IconName; title: string; text: string }) {
  return <div className="how-item"><span className="how-item__icon"><Icon name={icon} size={16} /></span><span><strong>{title}</strong><small>{text}</small></span><Icon name="check" size={15} /></div>;
}

function ProcessingState({ preview }: { preview: string | null }) {
  return <div className="processing-card"><div className={`processing-visual ${preview ? "processing-visual--photo" : ""}`} style={{ backgroundImage: `url(${preview ?? "/images/pho-bo.jpg"})` }}><div className="scan-line" /><span className="processing-badge"><span className="pulse-dot" /> Looking closely</span></div><div className="processing-copy"><div className="loader-ring" /><p className="section-kicker">AI is analyzing your meal</p><h3>Finding the details<br />that matter.</h3><p>Recognizing foods, estimating portions, and matching them to trusted nutrition data.</p><div className="processing-list"><span><Icon name="check" size={14} /> Identifying ingredients</span><span><Icon name="check" size={14} /> Estimating portion size</span><span className="processing-list__pending"><span className="tiny-spinner" /> Checking nutrition source</span></div></div></div>;
}

function ReviewState({ preview, detected, onRemove, onConfirm }: { preview: string | null; detected: DetectedItem[]; onRemove: (id: string) => void; onConfirm: () => void }) {
  return <div className="review-grid"><div className={`review-photo ${preview ? "review-photo--uploaded" : ""}`} style={{ backgroundImage: `url(${preview ?? "/images/pho-bo.jpg"})` }}><div className="review-photo__label"><span className="pulse-dot" /> Image analyzed</div><div className="recognition-box recognition-box--beef"><span>Beef</span><i /></div><div className="recognition-box recognition-box--noodles"><span>Noodles</span><i /></div><div className="recognition-box recognition-box--herbs"><span>Herbs</span><i /></div></div><div className="review-panel"><div className="review-panel__heading"><div><p className="section-kicker">Step 2 of 3</p><h3>Does this look right?</h3><p>We found 4 items in your meal. Adjust anything that looks off.</p></div><span className="confidence-badge"><span className="confidence-dot" /> 87% confident</span></div><div className="detected-list">{detected.map((item) => <DetectedRow key={item.id} item={item} onRemove={onRemove} />)}</div><div className="portion-field"><label htmlFor="portion">Overall portion</label><button type="button" id="portion" className="select-field"><span>1 medium bowl</span><Icon name="chevron" size={15} /></button></div><button type="button" className="primary-button primary-button--wide" onClick={onConfirm}>Looks good, show nutrition <Icon name="arrow" size={16} /></button><button type="button" className="add-item-link"><Icon name="plus" size={15} /> Add another ingredient</button><p className="disclaimer"><Icon name="info" size={14} /> Nutrition is estimated from the items and portions you confirm.</p></div></div>;
}

function detectedImage(id: string) {
  if (id === "beef") return "/images/chicken-bowl.jpg";
  if (id === "herbs") return "/images/spring-rolls.jpg";
  return "/images/pho-bo.jpg";
}

function DetectedRow({ item, onRemove }: { item: DetectedItem; onRemove: (id: string) => void }) {
  return <div className="detected-row"><span className="detected-food-icon"><img src={detectedImage(item.id)} alt="" /></span><span className="detected-row__copy"><strong>{item.name}</strong><small>{item.detail}</small></span><span className="detected-row__portion">{item.portion}</span><span className="detected-row__confidence">{Math.round(item.confidence * 100)}%</span>{item.removable !== false && <button type="button" className="remove-item" aria-label={`Remove ${item.name}`} onClick={() => onRemove(item.id)}><Icon name="close" size={15} /></button>}</div>;
}

function ResultState({ preview, onSave, saved, onReset }: { preview: string | null; onSave: () => void; saved: boolean; onReset: () => void }) {
  return <div className="result-grid"><div className="result-summary"><div className={`result-photo ${preview ? "result-photo--uploaded" : ""}`} style={{ backgroundImage: `url(${preview ?? "/images/pho-bo.jpg"})` }}><span className="result-photo__tag"><Icon name="check" size={14} /> Confirmed meal</span></div><div className="result-title-row"><div><p className="section-kicker">Estimated nutrition · 1 medium bowl</p><h3>Phở bò</h3><p className="muted-copy">Beef · rice noodles · herbs · broth</p></div><span className="confidence-badge"><span className="confidence-dot" /> 87% confident</span></div><div className="result-facts"><Fact label="Energy" value="560" unit="kcal" tone="lavender" /><Fact label="Protein" value="28" unit="g" tone="peach" /><Fact label="Carbs" value="52" unit="g" tone="blue" /><Fact label="Fat" value="14" unit="g" tone="yellow" /></div><div className="result-secondary"><span><strong>Fiber</strong> 5 g</span><span><strong>Sodium</strong> 1,100 mg <em>higher</em></span><span><strong>Sugar</strong> 4 g</span></div><div className="result-actions"><button type="button" className={`primary-button ${saved ? "primary-button--saved" : ""}`} onClick={onSave}>{saved ? <><Icon name="check" size={16} /> Saved to diary</> : <>Save to diary <Icon name="arrow" size={16} /></>}</button><button type="button" className="secondary-button" onClick={onReset}>Analyze another</button></div><p className="source-note"><Icon name="shield" size={14} /> Matched to curated Vietnamese food data · Values vary by recipe and portion.</p></div><div className="explanation-column"><div className="explanation-card explanation-card--positive"><div className="explanation-card__heading"><span className="explanation-icon"><Icon name="sparkles" size={16} /></span><span><p className="section-kicker">AI interpretation</p><h3>What looks good</h3></span></div><ul><li><Icon name="check" size={15} /> A satisfying protein source from beef</li><li><Icon name="check" size={15} /> Fresh herbs and sprouts add variety</li></ul></div><div className="explanation-card explanation-card--attention"><div className="explanation-card__heading"><span className="explanation-icon"><Icon name="leaf" size={16} /></span><span><p className="section-kicker">A possible next step</p><h3>Balance, gently</h3></span></div><p>The broth may be relatively high in sodium depending on the recipe. Add a fruit or extra vegetable later today for more variety.</p><button type="button" className="link-button">Ask AI about this meal <Icon name="arrow" size={14} /></button></div><div className="transparency-card"><div><Icon name="info" size={16} /><strong>How this estimate works</strong></div><p>Food recognition and database matching are separate steps. Your confirmed items are what shape the result.</p></div></div></div>;
}

function Fact({ label, value, unit, tone }: { label: string; value: string; unit: string; tone: string }) {
  return <div className={`fact fact--${tone}`}><span>{label}</span><strong>{value}<small>{unit}</small></strong></div>;
}

function DiaryView({ meals, initialSearch }: { meals: Meal[]; initialSearch: string }) {
  const [period, setPeriod] = useState("Today");
  const [query, setQuery] = useState(initialSearch);
  const filteredMeals = meals.filter((meal) => `${meal.name} ${meal.description}`.toLowerCase().includes(query.toLowerCase()));
  const grouped = ["Breakfast", "Lunch", "Dinner", "Snack"].map((type) => ({ type: type as MealType, meals: filteredMeals.filter((meal) => meal.type === type) })).filter((group) => group.meals.length);
  return <div className="view"><section className="view-heading view-heading--row"><div><p className="section-kicker">A clear record, without judgment</p><h2>Food diary</h2><p className="muted-copy">Notice patterns over time. Every entry is an estimate.</p></div><button type="button" className="primary-button"><Icon name="plus" size={16} /> Log a meal</button></section><div className="diary-toolbar"><div className="period-tabs">{["Today", "Yesterday", "This week"].map((item) => <button type="button" key={item} className={period === item ? "period-tab--active" : ""} onClick={() => setPeriod(item)}>{item}</button>)}</div><label className="diary-search"><Icon name="search" size={16} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Filter meals" aria-label="Filter meals" /></label></div><div className="diary-layout"><div className="diary-timeline"><div className="timeline-date"><span className="timeline-date__line" /><div><strong>Saturday, August 22</strong><small>{meals.length} meals · {dailyTotals.calories.toLocaleString()} estimated kcal</small></div><span className="date-status"><Icon name="check" size={14} /> On track</span></div>{grouped.length ? grouped.map((group) => <div className="diary-group" key={group.type}><div className="diary-group__label"><span>{group.type}</span><i /></div>{group.meals.map((meal) => <MealCard key={meal.id} meal={meal} />)}</div>) : <div className="empty-state"><span className="empty-state__icon"><Icon name="search" size={20} /></span><h3>No meals found</h3><p>Try another search or log a new meal.</p></div>}</div><aside className="diary-summary"><div className="summary-card"><div className="panel-heading"><div><p className="section-kicker">Today at a glance</p><h3>Nutrition mix</h3></div><Icon name="chart" size={18} /></div><div className="macro-bars"><MacroBar label="Protein" value="67 g" percent={74} tone="peach" /><MacroBar label="Carbohydrates" value="122 g" percent={58} tone="blue" /><MacroBar label="Fat" value="37 g" percent={48} tone="yellow" /></div><div className="summary-divider" /><div className="summary-stat"><span>Plant foods</span><strong>4 <small>types</small></strong></div><div className="summary-stat"><span>Water</span><strong>1.25 <small>L</small></strong></div></div><div className="diary-note"><Icon name="sparkles" size={17} /><p><strong>Keep noticing</strong><br />You’re getting protein across the day. Variety is the next small lever.</p></div></aside></div></div>;
}

function MacroBar({ label, value, percent, tone }: { label: string; value: string; percent: number; tone: string }) {
  return <div className="macro-bar"><div><span>{label}</span><strong>{value}</strong></div><div className="macro-track"><i className={`macro-fill macro-fill--${tone}`} style={{ width: `${percent}%` }} /></div></div>;
}

function InsightsView() {
  return <div className="view"><section className="view-heading view-heading--row"><div><p className="section-kicker">Patterns, not pressure</p><h2>Nutrition insights</h2><p className="muted-copy">A weekly view of the habits you’re building.</p></div><button type="button" className="date-picker"><span className="date-picker__dot" /> Last 7 days <Icon name="chevron" size={15} /></button></section><div className="insights-top-grid"><div className="balance-card"><div className="balance-card__copy"><p className="section-kicker">Meal balance</p><h3>A thoughtful week<br /><em>takes shape.</em></h3><p>Your strongest dimension is protein variety. One more vegetable serving on most days would bring more balance.</p></div><div className="balance-ring" style={{ background: "conic-gradient(#4a8d71 0 78%, #e5ece1 78% 100%)" }}><div><strong>78</strong><span>balanced</span></div></div></div><div className="streak-card"><div className="panel-heading"><div><p className="section-kicker">Consistency</p><h3>Meals logged</h3></div><span className="trend-up"><Icon name="arrow" size={13} /> 12%</span></div><div className="streak-number"><strong>18</strong><span>of 21 meals</span></div><div className="week-dots">{["M", "T", "W", "T", "F", "S", "S"].map((day, index) => <div key={`${day}-${index}`}><span className={index < 5 ? "week-dot--filled" : index === 5 ? "week-dot--today" : ""}>{index < 5 ? <Icon name="check" size={12} /> : index === 5 ? "" : ""}</span><small>{day}</small></div>)}</div><p className="muted-copy">Logging helps you notice. It doesn’t need to be perfect.</p></div></div><div className="analytics-grid"><section className="panel chart-panel"><div className="panel-heading"><div><p className="section-kicker">Nutrient rhythm</p><h3>Protein & fiber</h3></div><div className="chart-legend"><span><i className="legend-dot legend-dot--protein" /> Protein</span><span><i className="legend-dot legend-dot--fiber" /> Fiber</span></div></div><div className="bar-chart">{[{ day: "M", protein: 58, fiber: 42 }, { day: "T", protein: 74, fiber: 55 }, { day: "W", protein: 68, fiber: 62 }, { day: "T", protein: 82, fiber: 48 }, { day: "F", protein: 61, fiber: 72 }, { day: "S", protein: 86, fiber: 56 }, { day: "S", protein: 74, fiber: 64 }].map((item, index) => <div className="chart-column" key={`${item.day}-${index}`}><div className="bar-pair"><i className="chart-bar chart-bar--protein" style={{ height: `${item.protein}%` }} /><i className="chart-bar chart-bar--fiber" style={{ height: `${item.fiber}%` }} /></div><small>{item.day}</small></div>)}</div></section><section className="panel diversity-panel"><div className="panel-heading"><div><p className="section-kicker">Food diversity</p><h3>7 food groups</h3></div><span className="diversity-score">Good</span></div><div className="diversity-list"><DiversityRow image="/images/yogurt-berries.jpg" label="Fruits" count="4" total="5" percent={80} /><DiversityRow image="/images/spring-rolls.jpg" label="Vegetables" count="5" total="7" percent={71} /><DiversityRow image="/images/breakfast.jpg" label="Whole grains" count="2" total="3" percent={66} /><DiversityRow image="/images/chicken-bowl.jpg" label="Nuts & seeds" count="2" total="3" percent={66} /></div><button type="button" className="link-button">Explore food variety <Icon name="arrow" size={14} /></button></section></div><div className="insight-callout"><span className="insight-icon"><Icon name="sparkles" size={16} /></span><div><strong>Your week in one sentence</strong><p>You’re building balanced meals with a steady protein base. Keep experimenting with color and texture.</p></div><button type="button" className="secondary-button">Ask AI to explain <Icon name="arrow" size={15} /></button></div></div>;
}

function DiversityRow({ image, label, count, total, percent }: { image: string; label: string; count: string; total: string; percent: number }) {
  return <div className="diversity-row"><span className="diversity-emoji"><img src={image} alt="" /></span><span className="diversity-label"><strong>{label}</strong><small>{count} of {total} days</small></span><span className="diversity-track"><i style={{ width: `${percent}%` }} /></span></div>;
}

function AssistantView({ messages, input, setInput, onSend }: { messages: ChatMessage[]; input: string; setInput: (value: string) => void; onSend: (event?: FormEvent) => void }) {
  const prompts = ["What should I add to my next meal?", "Why is fiber important?", "Explain my phở estimate"];
  return <div className="view view--assistant"><section className="assistant-heading"><div className="assistant-heading__orb"><Icon name="sparkles" size={24} /></div><div><p className="section-kicker">Your grounded food companion</p><h2>Ask NutriAI</h2><p className="muted-copy">Short answers first. Clear sources always.</p></div><span className="assistant-grounding"><span className="pulse-dot" /> Connected to today’s diary</span></section><div className="assistant-layout"><div className="chat-card"><div className="chat-card__top"><div><strong>NutriAI assistant</strong><small>Nutrition education, not medical advice</small></div><span className="online-status"><i /> Online</span></div><div className="message-list">{messages.map((message) => <div className={`message-row message-row--${message.role}`} key={message.id}><span className={`message-avatar ${message.role === "assistant" ? "message-avatar--ai" : "message-avatar--user"}`}>{message.role === "assistant" ? <Icon name="sparkles" size={15} /> : "T"}</span><div className="message-bubble"><p>{message.content}</p>{message.meta && <small><Icon name="shield" size={12} /> {message.meta}</small>}</div></div>)}</div><div className="prompt-row">{prompts.map((prompt) => <button type="button" key={prompt} onClick={() => setInput(prompt)}>{prompt}</button>)}</div><form className="chat-input" onSubmit={onSend}><input value={input} onChange={(event) => setInput(event.target.value)} placeholder="Ask about your food..." aria-label="Ask NutriAI" /><button type="submit" aria-label="Send message"><Icon name="send" size={17} /></button></form></div><aside className="assistant-context"><div className="context-card"><div className="panel-heading"><div><p className="section-kicker">Context used</p><h3>Today’s picture</h3></div><Icon name="info" size={17} /></div><div className="context-row"><span className="context-row__icon context-row__icon--peach"><Icon name="flame" size={16} /></span><span><strong>67 g protein</strong><small>Across 3 meals</small></span></div><div className="context-row"><span className="context-row__icon context-row__icon--green"><Icon name="leaf" size={16} /></span><span><strong>4 plant foods</strong><small>Logged today</small></span></div><div className="context-row"><span className="context-row__icon context-row__icon--blue"><Icon name="water" size={16} /></span><span><strong>1.25 L water</strong><small>So far today</small></span></div></div><div className="assistant-safety"><Icon name="shield" size={17} /><p><strong>Thoughtful by design</strong><br />NutriAI explains patterns without diagnosing or judging your choices.</p></div></aside></div></div>;
}

function RecipesView() {
  const [filter, setFilter] = useState("All recipes");
  const filters = ["All recipes", "High protein", "Vegetarian", "Quick meals"];
  return <div className="view"><section className="view-heading view-heading--row"><div><p className="section-kicker">Good food, made doable</p><h2>Recipes for real life</h2><p className="muted-copy">Ideas that fit the way you already eat.</p></div><button type="button" className="secondary-button"><Icon name="bookmark" size={16} /> Saved recipes</button></section><div className="filter-tabs">{filters.map((item) => <button type="button" key={item} className={filter === item ? "filter-tab--active" : ""} onClick={() => setFilter(item)}>{item}</button>)}</div><div className="recipe-grid">{recipes.filter((recipe) => filter === "All recipes" || recipe.tag === filter).map((recipe) => <RecipeCard recipe={recipe} key={recipe.id} />)}</div><div className="recipe-bottom-callout"><div className="recipe-bottom-callout__art"><img src="/images/yogurt-berries.jpg" alt="" /></div><div><p className="section-kicker">Not sure what to make?</p><h3>Ask AI to build a meal around what you have.</h3></div><button type="button" className="primary-button">Ask AI <Icon name="arrow" size={16} /></button></div></div>;
}

function RecipeCard({ recipe }: { recipe: Recipe }) {
  return <article className="recipe-card"><div className={`recipe-art ${recipe.art}`} style={{ backgroundImage: `url(${recipe.image})` }}><span className="recipe-bookmark"><Icon name="bookmark" size={16} /></span><span className="recipe-time"><Icon name="clock" size={13} /> {recipe.time}</span></div><div className="recipe-card__body"><span className="recipe-tag">{recipe.tag}</span><h3>{recipe.title}</h3><p>{recipe.description}</p><div className="recipe-nutrition"><span><strong>{recipe.protein}</strong> protein</span><span><strong>{recipe.fiber}</strong> fiber</span><button type="button" aria-label={`Open ${recipe.title}`}><Icon name="arrow" size={15} /></button></div></div></article>;
}

function ProfileView() {
  return <div className="view"><section className="view-heading"><p className="section-kicker">Your space</p><h2>Profile & settings</h2><p className="muted-copy">Shape NutriAI around your needs. You’re always in control.</p></section><div className="profile-layout"><div className="profile-main"><section className="profile-hero"><span className="profile-hero__avatar">T</span><div><h3>Thanh Nguyen</h3><p>Member since August 2026 · Personal account</p></div><button type="button" className="secondary-button"><Icon name="edit" size={15} /> Edit profile</button></section><ProfileSection icon="user" title="Your preferences" description="Used to make suggestions more relevant"><SettingRow label="Nutrition interests" value="Balanced meals, food education" /><SettingRow label="Dietary preferences" value="No preference added" action="Add" /><SettingRow label="Allergies" value="No allergies added" action="Add" /></ProfileSection><ProfileSection icon="settings" title="App experience" description="Make NutriAI feel like yours"><SettingRow label="Language" value="English (US)" /><SettingRow label="Appearance" value="System default" /><SettingRow label="Notifications" value="Meal reminders, weekly insights" action="Edit" /></ProfileSection></div><aside className="profile-side"><div className="privacy-card privacy-card--large"><span className="privacy-card__icon"><Icon name="shield" size={19} /></span><div><strong>Your data, your choice</strong><p>We only use what helps personalize your nutrition experience.</p><button type="button" className="link-button">Read our privacy promise <Icon name="external" size={13} /></button></div></div><div className="data-actions"><p className="section-kicker">Your data</p><button type="button"><Icon name="download" size={16} /> Export my data <Icon name="arrow" size={14} /></button><button type="button" className="data-action--danger"><Icon name="trash" size={16} /> Delete account <Icon name="arrow" size={14} /></button></div></aside></div></div>;
}

function ProfileSection({ icon, title, description, children }: { icon: IconName; title: string; description: string; children: ReactNode }) {
  return <section className="settings-section"><div className="settings-section__heading"><span className="settings-icon"><Icon name={icon} size={17} /></span><div><h3>{title}</h3><p>{description}</p></div></div><div className="settings-list">{children}</div></section>;
}

function SettingRow({ label, value, action }: { label: string; value: string; action?: string }) {
  return <div className="setting-row"><span><strong>{label}</strong><small>{value}</small></span>{action ? <button type="button" className="link-button">{action} <Icon name="arrow" size={13} /></button> : <Icon name="chevron" size={16} />}</div>;
}

export default App;
