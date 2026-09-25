import React, { useState, useMemo, createContext } from "react";

const QueueSelectedContext = createContext();

const QueueSelectedProvider = ({ children }) => {
	const [selectedQueuesMessage, setSelectedQueuesMessage] = useState([]);
	const value = useMemo(
		() => ({ selectedQueuesMessage, setSelectedQueuesMessage }),
		[selectedQueuesMessage]
	);
	return (
		<QueueSelectedContext.Provider value={value}>
			{children}
		</QueueSelectedContext.Provider>
	);
};

export { QueueSelectedContext, QueueSelectedProvider };
