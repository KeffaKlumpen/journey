import { BrowserRouter, Routes, Route } from "react-router";
import GamePage from "./pages/game/GamePage";
import LobbyPage from "./pages/lobby/LobbyPage";
import HomePage from "./pages/home/HomePage";

export function Router() {
    return (
        <BrowserRouter>
            <Routes>
                <Route path="/" element={<HomePage />} />
                <Route path="/lobby" element={<LobbyPage />} />
                <Route path="/game" element={<GamePage />} />
            </Routes>
        </BrowserRouter>
    )
}