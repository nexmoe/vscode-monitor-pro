const BYTE_UNITS: string[] = [
	"B",
	"kB",
	"MB",
	"GB",
	"TB",
	"PB",
	"EB",
	"ZB",
	"YB",
];

const BI_BYTE_UNITS: string[] = [
	"B",
	"KiB",
	"MiB",
	"GiB",
	"TiB",
	"PiB",
	"EiB",
	"ZiB",
	"YiB",
];

const BIT_UNITS: string[] = [
	"b",
	"kbit",
	"Mbit",
	"Gbit",
	"Tbit",
	"Pbit",
	"Ebit",
	"Zbit",
	"Ybit",
];

const BI_BIT_UNITS: string[] = [
	"b",
	"kibit",
	"Mibit",
	"Gibit",
	"Tibit",
	"Pibit",
	"Eibit",
	"Zibit",
	"Yibit",
];

/**
 * Converts a number to a localized string representation.
 *
 * @param number - The number to convert.
 * @param locale - The locale or locales to use for formatting. Can be a string, an array of strings, or a boolean.
 * @param options - The formatting options.
 * @returns The localized string representation of the number.
 */
const toLocaleString = (
	number: number,
	locale: string | string[] | boolean | undefined,
	options?: any
): string => {
	return typeof locale === "string" || Array.isArray(locale)
		? number.toLocaleString(locale, options)
		: locale === true || options !== undefined
		? number.toLocaleString(undefined, options)
		: number.toString();
};

export default function byteFormat(
	number: number,
	{
		bits = false,
		binary = false,
		space = true,
		single = false,
		suffix = true,
		locale,
		signed,
		...option2
	}: {
		bits?: boolean;
		binary?: boolean;
		space?: boolean;
		single?: boolean;
		suffix?: boolean;
		locale?: string | string[] | boolean;
		signed?: boolean;
		option2?: Intl.NumberFormatOptions;
	}
): string {
	if (!Number.isFinite(number)) {
		throw new TypeError(
			`Expected a finite number, got ${typeof number}: ${number}`
		);
	}

	const UNITS = bits
		? binary
			? BI_BIT_UNITS
			: BIT_UNITS
		: binary
		? BI_BYTE_UNITS
		: BYTE_UNITS;

	const separator = space ? " " : "";

	if (signed && number === 0) {
		return ` 0${separator}${UNITS[0]}`;
	}

	const isNegative = number < 0;
	const prefix = isNegative ? "-" : signed ? "+" : "";

	if (isNegative) {
		number = -number;
	}

	if (number < 1) {
		const numberString = toLocaleString(number, locale, option2);
		return prefix + numberString + separator + UNITS[0];
	}

	const exponent = Math.min(
		Math.floor(
			binary ? Math.log(number) / Math.log(1024) : Math.log10(number) / 3
		),
		UNITS.length - 1
	);
	number /= (binary ? 1024 : 1000) ** exponent;

	if (!option2) {
		number = Number(number.toPrecision(3));
	}

	const numberString = toLocaleString(number, locale, option2);

	const unit = single ? UNITS[exponent][0] : UNITS[exponent];

	return prefix + numberString + (suffix ? separator + unit : "");
}
