import { BrowserRouter, Routes, Route, Outlet } from "react-router";
import GamePage from "./pages/game/GamePage";
import LobbyPage from "./pages/lobby/LobbyPage";
import HomePage from "./pages/home/HomePage";
import { PeerProvider } from "./net/PeerProvider";

export function Router() {
    return (
        <BrowserRouter>
            <Routes>
                <Route path="/" element={<HomePage />} />
                <Route element={<PeerProvider><Outlet /></PeerProvider>}>
                    <Route path="/lobby" element={<LobbyPage />} />
                    <Route path="/game" element={<GamePage />} />
                </Route>
            </Routes>
        </BrowserRouter>
    )
}