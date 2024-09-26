export namespace Meta {
	export interface Count {
		readonly topicsCount: string;
		readonly labelsCount: string;
		readonly ingressesCount: string;
		readonly egressesCount: string;
	}

}

export type Meta = Meta.Count;
