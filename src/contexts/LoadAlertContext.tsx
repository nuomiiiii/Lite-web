import React from "react";

export interface LoadAlert {
  id?: number;
  name?: string;
  clients?: string[];
  default_on?: boolean;
  metric?: "cpu" | "ram" | "disk" | "net_in" | "net_out";
  threshold?: number;
  ratio?: number;
  interval?: number;
  last_notified?: string;
  [property: string]: any;
}

export interface CurrentLoadAlert {
  notification_id: number;
  notification_name: string;
  client: string;
  client_name: string;
  metric: string;
  threshold: number;
  ratio: number;
  interval: number;
  active_since?: string | null;
  last_evaluated_at: string;
  latest_value: number;
  matched_samples: number;
  total_samples: number;
  silenced: boolean;
  silenced_until?: string | null;
  silenced_forever: boolean;
}

interface Response {
  data: LoadAlert[];
  message: string;
  status: string;
  [property: string]: any;
}

interface LoadAlertContextType {
  loadAlerts: LoadAlert[] | null;
	currentAlerts: CurrentLoadAlert[] | null;
  isLoading: boolean;
	currentLoading: boolean;
  error: string | null;
  refresh: () => void;
	refreshCurrent: () => Promise<void>;
}

const LoadAlertContext = React.createContext<LoadAlertContextType | undefined>(
  undefined
);

export const LoadAlertProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [loadAlerts, setLoadAlerts] = React.useState<LoadAlert[] | null>(null);
	const [currentAlerts, setCurrentAlerts] = React.useState<CurrentLoadAlert[] | null>(null);
  const [isLoading, setIsLoading] = React.useState<boolean>(false);
	const [currentLoading, setCurrentLoading] = React.useState<boolean>(false);
  const [error, setError] = React.useState<string | null>(null);

  const refresh = () => {
    setError(null);
    fetch("/api/admin/notification/load")
      .then((response) => {
        if (!response.ok) {
          throw new Error("Failed to fetch notification tasks");
        }
        return response.json();
      })
      .then((resp: Response) => {
        if (resp && Array.isArray(resp.data)) {
          setLoadAlerts(resp.data);
        } else {
          setLoadAlerts([]);
        }
      })
      .catch((err) => {
        setError(err.message || "An error occurred while fetching load alerts");
      })
      .finally(() => {
        setIsLoading(false);
      });
  };

	const refreshCurrent = React.useCallback(async () => {
		setCurrentLoading(true);
		try {
			const response = await fetch("/api/admin/notification/load/current", { cache: "no-store" });
			if (!response.ok) throw new Error("Failed to fetch current load alerts");
			const resp: Response & { data: CurrentLoadAlert[] } = await response.json();
			setCurrentAlerts(resp && Array.isArray(resp.data) ? resp.data : []);
		} finally {
			setCurrentLoading(false);
		}
	}, []);

  React.useEffect(() => {
    setIsLoading(true);

    refresh();
    setIsLoading(false);
  }, []);

  return (
		<LoadAlertContext.Provider value={{
			loadAlerts,
			currentAlerts,
			isLoading,
			currentLoading,
			error,
			refresh,
			refreshCurrent,
		}}>
      {children}
    </LoadAlertContext.Provider>
  );
};

export const useLoadAlert = () => {
  const context = React.useContext(LoadAlertContext);
  if (!context) {
    throw new Error("useLoadAlert must be used within a LoadAlertProvider");
  }
  return context;
};
