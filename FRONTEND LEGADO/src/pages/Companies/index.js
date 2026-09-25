import React from "react";
import MainContainer from "../../components/MainContainer";
import MainHeader from "../../components/MainHeader";
import Title from "../../components/Title";
import CompaniesManager from "../../components/CompaniesManager";

const Companies = () => {
  return (
    <MainContainer>
      <MainHeader>
        <Title>Empresas</Title>
      </MainHeader>
      <CompaniesManager />
    </MainContainer>
  );
};

export default Companies;
