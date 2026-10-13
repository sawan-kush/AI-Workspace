import { Route, Routes } from "react-router-dom";
import TopBar from "./components/TopBar";
import Dashboard from "./pages/Dashboard";
import AgentView from "./pages/AgentView";

export default function App() {
  return (
    <>
      <TopBar />
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/agent/:id" element={<AgentView />} />
      </Routes>
    </>
  );
}
