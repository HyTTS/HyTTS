import {
    Duration,
    Instant,
    LocalDate,
    LocalDateTime,
    LocalTime,
    Month,
    Period,
    Year,
    YearMonth,
    ZonedDateTime,
} from "@js-joda/core";
import { z } from "zod";

export const zLocalDate = () =>
    z
        .custom<LocalDate>((v) => v instanceof LocalDate)
        .or(
            z.string().transform((v, ctx) => {
                try {
                    return LocalDate.parse(v);
                } catch {
                    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Not a local date" });
                    return z.NEVER;
                }
            }),
        );

export const zDuration = () =>
    z
        .custom<Duration>((v) => v instanceof Duration)
        .or(
            z.string().transform((v, ctx) => {
                try {
                    return Duration.parse(v);
                } catch {
                    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Not a duration" });
                    return z.NEVER;
                }
            }),
        );

export const zLocalTime = () =>
    z
        .custom<LocalTime>((v) => v instanceof LocalTime)
        .or(
            z.string().transform((v, ctx) => {
                try {
                    return LocalTime.parse(v);
                } catch {
                    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Not a local time" });
                    return z.NEVER;
                }
            }),
        );

export const zLocalDateTime = () =>
    z
        .custom<LocalDate>((v) => v instanceof LocalDate)
        .or(
            z.string().transform((v, ctx) => {
                try {
                    return LocalDateTime.parse(v);
                } catch {
                    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Not a local date time" });
                    return z.NEVER;
                }
            }),
        );

export const zZonedDateTime = () =>
    z
        .custom<ZonedDateTime>((v) => v instanceof ZonedDateTime)
        .or(
            z.string().transform((v, ctx) => {
                try {
                    return ZonedDateTime.parse(v);
                } catch {
                    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Not a zoned date time" });
                    return z.NEVER;
                }
            }),
        );

export const zPeriod = () =>
    z
        .custom<Period>((v) => v instanceof Period)
        .or(
            z.string().transform((v, ctx) => {
                try {
                    return Period.parse(v);
                } catch {
                    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Not a period" });
                    return z.NEVER;
                }
            }),
        );

export const zInstant = () =>
    z
        .custom<Instant>((v) => v instanceof Instant)
        .or(
            z.string().transform((v, ctx) => {
                try {
                    return Instant.parse(v);
                } catch {
                    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Not an instant" });
                    return z.NEVER;
                }
            }),
        );

export const zYear = () =>
    z
        .custom<Year>((v) => v instanceof Year)
        .or(
            z.string().transform((v, ctx) => {
                try {
                    return Year.parse(v);
                } catch {
                    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Not a year" });
                    return z.NEVER;
                }
            }),
        );

export const zMonth = () =>
    z
        .custom<Month>((v) => v instanceof Month)
        .or(
            z.coerce.number().transform((v, ctx) => {
                try {
                    return Month.of(v);
                } catch {
                    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Not a month" });
                    return z.NEVER;
                }
            }),
        );

export const zYearMonth = () =>
    z
        .custom<YearMonth>((v) => v instanceof YearMonth)
        .or(
            z.string().transform((v, ctx) => {
                try {
                    return YearMonth.parse(v);
                } catch {
                    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Not a year month" });
                    return z.NEVER;
                }
            }),
        );
