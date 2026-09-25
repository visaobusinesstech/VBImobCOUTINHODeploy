/**
 * Copyright (c) Visão Business. Todos os direitos reservados.
 * VB Solution CRM — propriedade intelectual da Visão Business.
 * Uso conforme LICENSE na raiz do repositório.
 */

import React from "react";
import { motion } from "framer-motion";

const MetricCard = ({
  title,
  value,
  change,
  changeType = "neutral",
  icon: Icon,
  delay = 0,
  className = "",
}) => (
  <motion.div
    initial={{ opacity: 0, y: 16 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.35, delay }}
    className={`realty-metric-card ${className}`.trim()}
  >
    <div className="realty-metric-card__body">
      <p className="realty-metric-card__title">{title}</p>
      <p className="realty-metric-card__value">{value}</p>
      {change ? (
        <p className={`realty-metric-card__change realty-metric-card__change--${changeType}`}>
          {change}
        </p>
      ) : null}
    </div>
    {Icon ? (
      <div className="realty-metric-card__icon">
        <Icon size={16} />
      </div>
    ) : null}
  </motion.div>
);

export default MetricCard;
