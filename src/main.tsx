import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./app/App";
import "./styles/styles.css";
import "./styles/typography.css";
import "./styles/templates.css";
import "./styles/template-table.css";
import "./styles/sites.css";
import "./styles/directories.css";
import "./styles/admin-registers.css";
import "./styles/permit-create.css";
import "./styles/template-builder.css";
import "./styles/companies.css";
import "./styles/auth.css";
import "./styles/analytics.css";
import "./styles/resources.css";

createRoot(document.getElementById("root")!).render(<StrictMode><BrowserRouter><App /></BrowserRouter></StrictMode>);
