import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import "./styles.css";
import "./typography.css";
import "./templates.css";
import "./template-table.css";
import "./sites.css";
import "./directories.css";
import "./admin-registers.css";
import "./permit-create.css";
import "./template-builder.css";
import "./companies.css";
import "./auth.css";
import "./analytics.css";
import "./resources.css";

createRoot(document.getElementById("root")!).render(<StrictMode><BrowserRouter><App /></BrowserRouter></StrictMode>);
