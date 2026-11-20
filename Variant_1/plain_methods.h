#pragma once
#include <concepts>
#include <type_traits>
#include <utility>
#include "functions.h"

template <typename Function>
concept function_of_x = std::invocable<Function, double> && 
                        std::convertible_to<std::invoke_result_t<Function, double>, double>;

template <typename Function>
double min_uniform_search(double a, double b, double eps, Function f, int& n) 
requires function_of_x<Function> {
    n = 0;
    double xk = a;
    double step = eps / 2;
    double min_result = xk;
    for (;xk <= b; xk += step) {
        min_result = (f(xk) < f(min_result)) ? xk : min_result;
        n++;
    }
    return min_result;
}

template <typename Function>
double min_local(double a, double b, double eps, Function f, int& n)
requires function_of_x<Function> {
    n = 0;
    while (b - a > 2 * eps) {
        double middle = (a + b) / 2.0;

        if (f(middle - eps) < f(middle + eps))
            b = middle;
        else
            a = middle;
        n++;
    }

    return (a + b) / 2.0;
}

template <typename Function>
double min_dihotomia(double a, double b, double eps, Function f, int& n)
requires function_of_x<Function> {
    n = 0;
    double xmiddle = (b + a) / 2.0; 
    if ((b - a) < 2 * eps) return xmiddle;
    double xleft = (xmiddle + a) / 2.0;
    double xright = (b + xmiddle) / 2.0;
    double fmiddle = f(xmiddle);
    double fleft = f(xleft);
    double fright = f(xright);
    while ((b - a) >= 2 * eps) {
        n++;
        if (fleft < fmiddle) {
            b = xmiddle;
            xmiddle = xleft;
            fmiddle = fleft;
            xright = (b + xmiddle) / 2.0;
            fright = f(xright);
            xleft = (xmiddle + a) / 2.0;
            fleft = f(xleft);
        } else if (fmiddle < fright) {
            a = xleft;
            b = xright;
            xleft = (xmiddle + a) / 2.0;
            fleft = f(xleft);
            xright = (b + xmiddle) / 2.0;
            fright = f(xright);
        } else {
            a = xmiddle;
            xmiddle = xright;
            fmiddle = fright;
            xright = (b + xmiddle) / 2.0;
            fright = f(xright);
            xleft = (xmiddle + a) / 2.0;
            fleft = f(xleft);
        }
    }
    return xmiddle;
}

template <typename Function> 
double min_golden_nation (double a, double b, double eps, Function f, int& n)
requires function_of_x<Function> {
    n = 0;
    double y = a + (3 - std::sqrt(5)) / 2.0 * (b - a);
    double z = b + a - y;
    double fy = f(y);
    double fz = f(z);
    while ((b - a) > eps) {
        n++;
        if (fy < fz) {
            b = z;
            z = y;
            fz = fy;
            y = a + b - z;
            fy = f(y);
        } else {
            a = y;
            y = z;
            fy = fz;
            z = a + b - y;
            fz = f(z);
        }
    }
    return fy < fz ? y : z;
}

template <typename Function> 
double min_Fibonacci(double a, double b, double eps, Function f, int& n)
requires function_of_x<Function> {
    n = 0;
    int fib[100];
    fib[0] = 1;
    fib[1] = 1;
    int count = 1;
    while (fib[count] < (b - a) / eps && count < 98) {
        count++;
        fib[count] = fib[count - 1] + fib[count - 2];
    }
    double x1 = a + (double)fib[count - 2] / fib[count] * (b - a);
    double x2 = a + (double)fib[count - 1] / fib[count] * (b - a);
    double f1 = f(x1);
    double f2 = f(x2);
    for (int i = 1; i < count - 1; i++) {
        n++;
        if (f1 < f2) {
            b = x2;
            x2 = x1;
            f2 = f1;
            x1 = a + (double)fib[count - i - 2] / fib[count - i] * (b - a);
            f1 = f(x1);
        } else {
            a = x1;
            x1 = x2;
            f1 = f2;
            x2 = a + (double)fib[count - i - 1] / fib[count - i] * (b - a);
            f2 = f(x2);
        }
    }
    double result = (a + b) / 2.0;
    if (f(a) < f(result)) result = a;
    if (f(b) < f(result)) result = b;
    return result;
}