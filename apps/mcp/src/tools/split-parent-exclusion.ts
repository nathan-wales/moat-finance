export const splitParentExclusionWhere = {
	OR: [{ splitGroupId: null }, { splitParentId: { not: null } }],
};
