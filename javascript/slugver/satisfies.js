export let satisfies = (version, range) => {
    if (!range)
        return false;
    return range.test(version);
};
