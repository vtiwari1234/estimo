import { useEffect, useState } from "react";
import { Home } from "./pages/Home";
import { RoomPage } from "./pages/RoomPage";
import { ROOM_ID_PATTERN } from "../shared/protocol";

function parse(pathname: string): { page: "home" } | { page: "room"; id: string } {
  const m = pathname.match(/^\/r\/([^/]+)\/?$/);
  if (m) {
    const id = decodeURIComponent(m[1]).toLowerCase();
    if (ROOM_ID_PATTERN.test(id)) return { page: "room", id };
  }
  return { page: "home" };
}

export function navigate(path: string) {
  history.pushState(null, "", path);
  window.dispatchEvent(new PopStateEvent("popstate"));
}

export function App() {
  const [route, setRoute] = useState(() => parse(location.pathname));
  useEffect(() => {
    const onPop = () => setRoute(parse(location.pathname));
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);
  if (route.page === "room") return <RoomPage key={route.id} roomId={route.id} />;
  return <Home />;
}
