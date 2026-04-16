import { Link, NavLink, Route, Routes } from "react-router-dom";
import Overview from "./routes/Overview";
import Agent from "./routes/Agent";
import Memory from "./routes/Memory";
import Wiki from "./routes/Wiki";

const navLink = ({ isActive }: { isActive: boolean }) =>
  `px-3 py-1.5 rounded-md text-sm transition-colors ${
    isActive ? "bg-zinc-800 text-zinc-100" : "text-zinc-400 hover:text-zinc-100"
  }`;

export default function App() {
  return (
    <div className="min-h-full">
      <header className="border-b border-zinc-800/80 bg-zinc-950/60 backdrop-blur sticky top-0 z-10">
        <div className="max-w-[1400px] mx-auto px-6 h-14 flex items-center justify-between">
          <Link to="/" className="flex items-baseline gap-3">
            <span className="font-mono text-lg font-semibold tracking-tight">icarus</span>
            <span className="text-xs text-zinc-500">shared brain · hermes runs the agents · icarus maintains what they learn</span>
          </Link>
          <nav className="flex items-center gap-1">
            <NavLink to="/" end className={navLink}>Overview</NavLink>
            <NavLink to="/memory" className={navLink}>Memory</NavLink>
            <NavLink to="/wiki" className={navLink}>Wiki</NavLink>
          </nav>
        </div>
      </header>

      <main className="max-w-[1400px] mx-auto px-6 py-6">
        <Routes>
          <Route path="/" element={<Overview />} />
          <Route path="/agents/:id" element={<Agent />} />
          <Route path="/memory" element={<Memory />} />
          <Route path="/wiki" element={<Wiki />} />
        </Routes>
      </main>
    </div>
  );
}
