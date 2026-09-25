import React, { useContext, useEffect } from "react";
import { Route as RouterRoute, Redirect } from "react-router-dom";
import moment from "moment";

import { AuthContext } from "../context/Auth/AuthContext";
import { PageTitleContext } from "../context/PageTitleContext";
import BackdropLoading from "../components/BackdropLoading";

const Route = ({ component: Component, isPrivate = false, title, allowWhenAuth = false, ...rest }) => {
	const { isAuth, loading, user } = useContext(AuthContext);
	const { setPageTitle } = useContext(PageTitleContext);

	useEffect(() => {
		// Título base sempre presente
		const baseTitle = "VBSolution";
		
		if (title) {
			// Se houver título da página: "Título - VBSolution"
			document.title = `${title} - ${baseTitle}`;
			setPageTitle(title);
		} else {
			// Se não houver, apenas "VBSolution"
			document.title = baseTitle;
			setPageTitle(baseTitle);
		}
	}, [title, setPageTitle]);

	// Verificar se a empresa está vencida
	const isCompanyExpired = () => {
		if (process.env.NODE_ENV !== "production") {
			return false;
		}
		if (!user || !user.company || user.company.id === 1) {
			return false; // Empresa ID 1 nunca expira
		}

		const dueDate = user.company.dueDate;
		if (!dueDate) return false;
		if (!moment(dueDate).isValid()) return false;

		// Comparar apenas as datas (sem horas) para permitir acesso até 23h59 do dia do vencimento
		const hojeInicio = moment().startOf('day');
		const vencimentoInicio = moment(dueDate).startOf('day');
		
		// Empresa está vencida apenas após o dia do vencimento
		return hojeInicio.isAfter(vencimentoInicio, 'day');
	};

	if (loading) {
		return <BackdropLoading />;
	}

	if (!isAuth && isPrivate) {
		return (
			<Redirect to={{ pathname: "/login", state: { from: rest.location } }} />
		);
	}

	if (isAuth && !isPrivate && !allowWhenAuth) {
		return (
			<Redirect to={{ pathname: "/", state: { from: rest.location } }} />
		);
	}

	if (isAuth && isPrivate && isCompanyExpired()) {
		if (rest.path !== "/financeiro-aberto") {
			return (
				<Redirect to={{ pathname: "/financeiro-aberto", state: { from: rest.location } }} />
			);
		}
	}

	return <RouterRoute {...rest} component={Component} />;
};

export default Route;
