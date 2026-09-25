import React from "react";
import ReactDOM from "react-dom";
import CssBaseline from "@material-ui/core/CssBaseline";
import * as serviceworker from './serviceWorker'
import "./styles/tailwind.css";
import "./styles/premium-design-system.css";
import "./styles/brain-theme.css";
import "./styles/brain-chrome.css";
import "./styles/brain-pages.css";
import "./styles/brain-shell.css";
import "./styles/brain-shell-tailwind.css";
import "./styles/brain-subpages.css";
import "./styles/brain-modals.css";

import App from "./App";

ReactDOM.render(
	<CssBaseline>
		<App />
	</CssBaseline>,
	document.getElementById("root")
);

serviceworker.register()