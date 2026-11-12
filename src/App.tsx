import { useEffect, useState } from "react";
import { Home } from "./pages/Home";
import { RoomPage } from "./pages/RoomPage";
import { ROOM_ID_PATTERN } from "../shared/protocol";
import { EDITION } from "./brand";
import { AccountPage, SignInPage } from "./pages/Account";
import { InfoPage, type InfoPageId } from "./pages/InfoPage";

const INFO_PAGES: InfoPageId[] = ["pricing", "terms", "privacy", "refunds"];

type Route = { page: "home" } | { page: "room"; id: string } | { page: "info"; id: InfoPageId } | { page: "account" } | { page: "signin" };

function parse(pathname: string): Route {
  const info = pathname.replace(/^\/|\/$/g, "") as InfoPageId;
  if (EDITION === "pro" && INFO_PAGES.includes(info)) return { page: "info", id: info };
  if (EDITION === "pro" && info === ("account" as string)) return { page: "account" };
  if (EDITION === "pro" && info === ("signin" as string)) return { page: "signin" };
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
  if (route.page === "info") return <InfoPage id={route.id} />;
  if (route.page === "account") return <AccountPage key={location.search} />;
  if (route.page === "signin") return <SignInPage />;
  return <Home />;
}
