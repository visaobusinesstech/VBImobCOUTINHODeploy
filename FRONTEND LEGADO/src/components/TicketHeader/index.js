import React from "react";

import { Card, IconButton, Tooltip } from "@material-ui/core";
import { makeStyles } from "@material-ui/core/styles";
import TicketHeaderSkeleton from "../TicketHeaderSkeleton";
import ArrowBackIosNewRounded from "@mui/icons-material/ArrowBackIosNewRounded";
import { useHistory } from "react-router-dom";

const useStyles = makeStyles(theme => ({
	ticketHeader: {
		display: "flex",
		background: theme.palette.type === "dark" ? theme.palette.total : "#ffffff",
		flex: "none",
		borderBottom:
			theme.palette.type === "dark" ? "none" : "1px solid #e7ebf3",
		boxShadow:
			theme.palette.type === "dark" ? "none" : undefined,
		height: "56px",
		width: "100%",
		maxWidth: "100%",
		alignItems: "center",
		justifyContent: "space-between",
		overflow: "visible",
		boxSizing: "border-box",
		paddingLeft: theme.spacing(0.25),
		paddingRight: theme.spacing(0.5),
		minWidth: 0,
		[theme.breakpoints.down("md")]: {
			flexWrap: "nowrap",
			height: 56,
			minHeight: 56,
			overflow: "hidden",
			paddingLeft: 4,
			paddingRight: 6,
			gap: 4,
		},
	},
	backBtn: {
		padding: 8,
		flexShrink: 0,
		color: theme.palette.type === "dark" ? "rgba(255,255,255,0.85)" : "#1d1d1f",
		"&:hover": {
			backgroundColor:
				theme.palette.type === "dark" ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.04)"
		},
		[theme.breakpoints.down("md")]: {
			padding: 10,
			minWidth: 44,
			minHeight: 44,
		},
	}
}));

const TicketHeader = ({ loading, children }) => {
	const classes = useStyles();
	const history = useHistory();

	const handleBack = () => {
		history.push("/tickets");
	};

	return (
		<>
			{loading ? (
				<TicketHeaderSkeleton />
			) : (
				<Card
					square
					elevation={0}
					className={classes.ticketHeader}
				>
					<Tooltip title="Voltar">
						<IconButton
							className={classes.backBtn}
							aria-label="Voltar para lista de tickets"
							onClick={handleBack}
							size="small"
						>
							<ArrowBackIosNewRounded style={{ fontSize: 22 }} />
						</IconButton>
					</Tooltip>
					{children}
				</Card>
			)}
		</>
	);
};

export default TicketHeader;
