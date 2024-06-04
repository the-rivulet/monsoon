import { Slugver } from "./slugver.js";
import { re, t, comparatorTrimReplace, tildeTrimReplace, caretTrimReplace, } from "./re.js";
const ANY = Symbol('SemVer ANY');
export class Comparator {
    loose = true;
    value;
    semver;
    operator;
    options = { loose: true };
    static get ANY() {
        return ANY;
    }
    constructor(c) {
        if (c instanceof Comparator && c.loose === !!true)
            return c;
        let comp = (c instanceof Comparator ? c.value : c);
        comp = comp.trim().split(/\s+/).join(' ');
        this.parse(comp);
        if (this.semver === ANY) {
            this.value = '';
        }
        else {
            this.value = this.operator + this.semver.version;
        }
    }
    parse(comp) {
        const r = re[t.COMPARATORLOOSE];
        const m = comp.match(r);
        if (!m) {
            throw new TypeError(`Invalid comparator: ${comp}`);
        }
        this.operator = m[1] !== undefined ? m[1] : '';
        if (this.operator === '=') {
            this.operator = '';
        }
        // if it literally is just '>' or '' then allow anything.
        if (!m[2]) {
            this.semver = ANY;
        }
        else {
            this.semver = new Slugver(m[2]);
        }
    }
    test(version) {
        if (this.semver === ANY || version === ANY) {
            return true;
        }
        if (typeof version === 'string') {
            try {
                version = new Slugver(version);
            }
            catch (er) {
                return false;
            }
        }
        return cmp(version, this.operator, this.semver, this.options);
    }
    intersects(comp, options) {
        if (!(comp instanceof Comparator)) {
            throw new TypeError('a Comparator is required');
        }
        if (this.operator === '') {
            if (this.value === '') {
                return true;
            }
            return new SlugverRange(comp.value).test(this.value);
        }
        else if (comp.operator === '') {
            if (comp.value === '') {
                return true;
            }
            return new SlugverRange(this.value).test(comp.semver);
        }
        // Special cases where nothing can possibly be lower
        if (options.includePrerelease &&
            (this.value === '<0.0.0-0' || comp.value === '<0.0.0-0')) {
            return false;
        }
        if (!options.includePrerelease &&
            (this.value.startsWith('<0.0.0') || comp.value.startsWith('<0.0.0'))) {
            return false;
        }
        // Same direction increasing (> or >=)
        if (this.operator.startsWith('>') && comp.operator.startsWith('>')) {
            return true;
        }
        // Same direction decreasing (< or <=)
        if (this.operator.startsWith('<') && comp.operator.startsWith('<')) {
            return true;
        }
        // same SemVer and both sides are inclusive (<= or >=)
        if ((this.semver.version === comp.semver.version) &&
            this.operator.includes('=') && comp.operator.includes('=')) {
            return true;
        }
        // opposite directions less than
        if (cmp(this.semver, '<', comp.semver, options) &&
            this.operator.startsWith('>') && comp.operator.startsWith('<')) {
            return true;
        }
        // opposite directions greater than
        if (cmp(this.semver, '>', comp.semver, options) &&
            this.operator.startsWith('<') && comp.operator.startsWith('>')) {
            return true;
        }
        return false;
    }
}
const compare = (a, b, loose) => new Slugver(a).compare(new Slugver(b));
const eq = (a, b, loose) => compare(a, b, loose) === 0;
const neq = (a, b, loose) => compare(a, b, loose) !== 0;
const gt = (a, b, loose) => compare(a, b, loose) > 0;
const gte = (a, b, loose) => compare(a, b, loose) >= 0;
const lt = (a, b, loose) => compare(a, b, loose) < 0;
const lte = (a, b, loose) => compare(a, b, loose) <= 0;
const cmp = (a, op, b, loose) => {
    switch (op) {
        case '===':
            if (typeof a === 'object') {
                a = a.version;
            }
            if (typeof b === 'object') {
                b = b.version;
            }
            return a === b;
        case '!==':
            if (typeof a === 'object') {
                a = a.version;
            }
            if (typeof b === 'object') {
                b = b.version;
            }
            return a !== b;
        case '':
        case '=':
        case '==':
            return eq(a, b, loose);
        case '!=':
            return neq(a, b, loose);
        case '>':
            return gt(a, b, loose);
        case '>=':
            return gte(a, b, loose);
        case '<':
            return lt(a, b, loose);
        case '<=':
            return lte(a, b, loose);
        default:
            throw new TypeError(`Invalid operator: ${op}`);
    }
};
export class SlugverRange {
    raw;
    set;
    range;
    loose = true;
    options = { loose: true, includePrerelease: false };
    constructor(range) {
        let options = { loose: true };
        if (range instanceof SlugverRange) {
            if (range.loose === !!options.loose) {
                return range;
            }
            else {
                return new SlugverRange(range.raw);
            }
        }
        if (range instanceof Comparator) {
            // just put it in the set and return
            this.raw = range.value;
            this.set = [[range]];
            this.format();
            return this;
        }
        this.raw = range
            .trim()
            .split(/\s+/)
            .join(' ');
        // First, split on ||
        this.set = this.raw
            .split('||')
            // map the range to a 2d array of comparators
            .map(r => this.parseRange(r.trim()))
            // throw out any comparator lists that are empty
            // this generally means that it was not a valid range, which is allowed
            // in loose mode, but will still throw if the WHOLE range is invalid.
            .filter(c => c.length);
        if (!this.set.length) {
            throw new TypeError(`Invalid SemVer Range: ${this.raw}`);
        }
        // if we have any that are not the null set, throw out null sets.
        if (this.set.length > 1) {
            // keep the first one, in case they're all null sets
            const first = this.set[0];
            this.set = this.set.filter(c => !isNullSet(c[0]));
            if (this.set.length === 0) {
                this.set = [first];
            }
            else if (this.set.length > 1) {
                // if we have any that are *, then the range is just *
                for (const c of this.set) {
                    if (c.length === 1 && isAny(c[0])) {
                        this.set = [c];
                        break;
                    }
                }
            }
        }
        this.format();
    }
    stringify() { return this.range; }
    format() {
        this.range = this.set
            .map((comps) => comps.join(' ').trim())
            .join('||')
            .trim();
        return this.range;
    }
    parseRange(range) {
        const loose = true;
        // `1.2.3 - 1.2.4` => `>=1.2.3 <=1.2.4`
        const hr = loose ? re[t.HYPHENRANGELOOSE] : re[t.HYPHENRANGE];
        range = range.replace(hr, hyphenReplace(this.options.includePrerelease));
        // `> 1.2.3 < 1.2.5` => `>1.2.3 <1.2.5`
        range = range.replace(re[t.COMPARATORTRIM], comparatorTrimReplace);
        // `~ 1.2.3` => `~1.2.3`
        range = range.replace(re[t.TILDETRIM], tildeTrimReplace);
        // `^ 1.2.3` => `^1.2.3`
        range = range.replace(re[t.CARETTRIM], caretTrimReplace);
        // At this point, the range is completely trimmed and
        // ready to be split into comparators.
        let rangeList = range
            .split(' ')
            .map(comp => parseComparator(comp))
            .join(' ')
            .split(/\s+/)
            // >=0.0.0 is equivalent to *
            .map(comp => replaceGTE0(comp))
            .filter(comp => {
            return !!comp.match(re[t.COMPARATORLOOSE]);
        });
        const rangeMap = new Map();
        const comparators = rangeList.map(comp => new Comparator(comp));
        for (const comp of comparators) {
            if (isNullSet(comp)) {
                return [comp];
            }
            rangeMap.set(comp.value, comp);
        }
        if (rangeMap.size > 1 && rangeMap.has('')) {
            rangeMap.delete('');
        }
        const result = [...rangeMap.values()];
        return result;
    }
    // if ANY of the sets match ALL of its comparators, then pass
    test(version) {
        if (!version) {
            return false;
        }
        if (typeof version === 'string') {
            try {
                version = new Slugver(version);
            }
            catch (er) {
                return false;
            }
        }
        for (let i = 0; i < this.set.length; i++) {
            if (testSet(this.set[i], version, this.options)) {
                return true;
            }
        }
        return false;
    }
}
const isNullSet = c => c.value === '<0.0.0-0';
const isAny = c => c.value === '';
const parseComparator = (comp) => {
    comp = replaceCarets(comp);
    comp = replaceTildes(comp);
    comp = replaceXRanges(comp);
    comp = replaceStars(comp);
    return comp;
};
const isX = id => !id || id.toLowerCase() === 'x' || id === '*';
// ~, ~> --> * (any, kinda silly)
// ~2, ~2.x, ~2.x.x, ~>2, ~>2.x ~>2.x.x --> >=2.0.0 <3.0.0-0
// ~2.0, ~2.0.x, ~>2.0, ~>2.0.x --> >=2.0.0 <2.1.0-0
// ~1.2, ~1.2.x, ~>1.2, ~>1.2.x --> >=1.2.0 <1.3.0-0
// ~1.2.3, ~>1.2.3 --> >=1.2.3 <1.3.0-0
// ~1.2.0, ~>1.2.0 --> >=1.2.0 <1.3.0-0
// ~0.0.1 --> >=0.0.1 <0.1.0-0
const replaceTildes = (comp) => {
    return comp
        .trim()
        .split(/\s+/)
        .map((c) => replaceTilde(c))
        .join(' ');
};
const replaceTilde = (comp) => {
    const r = re[t.TILDELOOSE];
    return comp.replace(r, (_, M, m, p, pr) => {
        let ret;
        if (isX(M)) {
            ret = '';
        }
        else if (isX(m)) {
            ret = `>=${M}.0.0 <${+M + 1}.0.0-0`;
        }
        else if (isX(p)) {
            // ~1.2 == >=1.2.0 <1.3.0-0
            ret = `>=${M}.${m}.0 <${M}.${+m + 1}.0-0`;
        }
        else if (pr) {
            ret = `>=${M}.${m}.${p}-${pr} <${M}.${+m + 1}.0-0`;
        }
        else {
            // ~1.2.3 == >=1.2.3 <1.3.0-0
            ret = `>=${M}.${m}.${p} <${M}.${+m + 1}.0-0`;
        }
        return ret;
    });
};
const replaceCarets = (comp) => {
    return comp
        .trim()
        .split(/\s+/)
        .map((c) => replaceCaret(c))
        .join(' ');
};
const replaceCaret = (comp) => {
    const r = re[t.CARETLOOSE];
    const z = '';
    return comp.replace(r, (_, M, m, p, pr) => {
        let ret;
        if (isX(M)) {
            ret = '';
        }
        else if (isX(m)) {
            ret = `>=${M}.0.0${z} <${+M + 1}.0.0-0`;
        }
        else if (isX(p)) {
            if (M === '0') {
                ret = `>=${M}.${m}.0${z} <${M}.${+m + 1}.0-0`;
            }
            else {
                ret = `>=${M}.${m}.0${z} <${+M + 1}.0.0-0`;
            }
        }
        else if (pr) {
            if (M === '0') {
                if (m === '0') {
                    ret = `>=${M}.${m}.${p}-${pr} <${M}.${m}.${+p + 1}-0`;
                }
                else {
                    ret = `>=${M}.${m}.${p}-${pr} <${M}.${+m + 1}.0-0`;
                }
            }
            else {
                ret = `>=${M}.${m}.${p}-${pr} <${+M + 1}.0.0-0`;
            }
        }
        else {
            if (M === '0') {
                if (m === '0') {
                    ret = `>=${M}.${m}.${p}${z} <${M}.${m}.${+p + 1}-0`;
                }
                else {
                    ret = `>=${M}.${m}.${p}${z} <${M}.${+m + 1}.0-0`;
                }
            }
            else {
                ret = `>=${M}.${m}.${p} <${+M + 1}.0.0-0`;
            }
        }
        return ret;
    });
};
const replaceXRanges = (comp) => {
    return comp
        .split(/\s+/)
        .map((c) => replaceXRange(c))
        .join(' ');
};
const replaceXRange = (comp) => {
    comp = comp.trim();
    const r = re[t.XRANGELOOSE];
    return comp.replace(r, (ret, gtlt, M, m, p, pr) => {
        const xM = isX(M);
        const xm = xM || isX(m);
        const xp = xm || isX(p);
        const anyX = xp;
        if (gtlt === '=' && anyX) {
            gtlt = '';
        }
        pr = '';
        if (xM) {
            if (gtlt === '>' || gtlt === '<') {
                ret = '<0.0.0-0';
            }
            else {
                ret = '*';
            }
        }
        else if (gtlt && anyX) {
            if (xm) {
                m = 0;
            }
            p = 0;
            if (gtlt === '>') {
                gtlt = '>=';
                if (xm) {
                    M = +M + 1;
                    m = 0;
                    p = 0;
                }
                else {
                    m = +m + 1;
                    p = 0;
                }
            }
            else if (gtlt === '<=') {
                gtlt = '<';
                if (xm) {
                    M = +M + 1;
                }
                else {
                    m = +m + 1;
                }
            }
            if (gtlt === '<') {
                pr = '-0';
            }
            ret = `${gtlt + M}.${m}.${p}${pr}`;
        }
        else if (xm) {
            ret = `>=${M}.0.0${pr} <${+M + 1}.0.0-0`;
        }
        else if (xp) {
            ret = `>=${M}.${m}.0${pr} <${M}.${+m + 1}.0-0`;
        }
        return ret;
    });
};
const replaceStars = (comp) => {
    return comp
        .trim()
        .replace(re[t.STAR], '');
};
const replaceGTE0 = (comp) => {
    return comp
        .trim()
        .replace(re[t.GTE0], '');
};
const hyphenReplace = incPr => ($0, from, fM, fm, fp, fpr, fb, to, tM, tm, tp, tpr) => {
    if (isX(fM)) {
        from = '';
    }
    else if (isX(fm)) {
        from = `>=${fM}.0.0${incPr ? '-0' : ''}`;
    }
    else if (isX(fp)) {
        from = `>=${fM}.${fm}.0${incPr ? '-0' : ''}`;
    }
    else if (fpr) {
        from = `>=${from}`;
    }
    else {
        from = `>=${from}${incPr ? '-0' : ''}`;
    }
    if (isX(tM)) {
        to = '';
    }
    else if (isX(tm)) {
        to = `<${+tM + 1}.0.0-0`;
    }
    else if (isX(tp)) {
        to = `<${tM}.${+tm + 1}.0-0`;
    }
    else if (tpr) {
        to = `<=${tM}.${tm}.${tp}-${tpr}`;
    }
    else if (incPr) {
        to = `<${tM}.${tm}.${+tp + 1}-0`;
    }
    else {
        to = `<=${to}`;
    }
    return `${from} ${to}`.trim();
};
const testSet = (set, version, options) => {
    for (let i = 0; i < set.length; i++) {
        if (!set[i].test(version)) {
            return false;
        }
    }
    if (version.prerelease.length && !options.includePrerelease) {
        for (let i = 0; i < set.length; i++) {
            if (set[i].semver === Comparator.ANY) {
                continue;
            }
            if (set[i].semver.prerelease.length > 0) {
                const allowed = set[i].semver;
                if (allowed.major === version.major &&
                    allowed.minor === version.minor &&
                    allowed.patch === version.patch) {
                    return true;
                }
            }
        }
        return false;
    }
    return true;
};
