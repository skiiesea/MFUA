#pragma once
#include <cmath>

template <typename Function>
double min_uniform_search(double a, double b, double eps, Function f, int& n) {
    double min_x = a;
    n = 0;

    for (double x = a; x <= b; x += eps) {
        if (f(x) < f(min_x)) min_x = x;
        n++;
    }

    if (f(b) < f(min_x)) min_x = b;
    return min_x;
}

template <typename Function>
double min_local(double a, double b, double eps, Function f, int& n) {
    n = 0;
    double step = (b - a) / 10.0;
    double x = a;

    while (x + step <= b && f(x + step) < f(x)) {
        x += step;
        n++;
    }

    double left = x - step;
    if (left < a) left = a;
    double right = x + step;
    if (right > b) right = b;

    while (right - left > 2 * eps) {
        double middle = (left + right) / 2.0;

        if (f(middle - eps) < f(middle + eps))
            right = middle;
        else
            left = middle;

        n++;
    }

    double result = (left + right) / 2.0;
    if (f(a) < f(result)) result = a;
    if (f(b) < f(result)) result = b;
    return result;
}

template <typename Function>
double min_dihotomia(double a, double b, double eps, Function f, int& n) {
    n = 0;

    while (b - a > 2 * eps) {
        double middle = (a + b) / 2.0;
        double x1 = middle - eps / 2.0;
        double x2 = middle + eps / 2.0;

        if (f(x1) < f(x2))
            b = x2;
        else
            a = x1;

        n++;
    }

    double result = (a + b) / 2.0;
    if (f(a) < f(result)) result = a;
    if (f(b) < f(result)) result = b;
    return result;
}

template <typename Function>
double min_golden_ration(double a, double b, double eps, Function f, int& n) {
    const double k = (std::sqrt(5.0) - 1.0) / 2.0;
    n = 0;

    double x1 = b - k * (b - a);
    double x2 = a + k * (b - a);
    double f1 = f(x1);
    double f2 = f(x2);

    while (b - a > eps) {
        if (f1 < f2) {
            b = x2;
            x2 = x1;
            f2 = f1;
            x1 = b - k * (b - a);
            f1 = f(x1);
        } else {
            a = x1;
            x1 = x2;
            f1 = f2;
            x2 = a + k * (b - a);
            f2 = f(x2);
        }

        n++;
    }

    double result = (a + b) / 2.0;
    if (f(a) < f(result)) result = a;
    if (f(b) < f(result)) result = b;
    return result;
}

template <typename Function>
double min_Fibonacci(double a, double b, double eps, Function f, int& n) {
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
    n = 0;

    for (int i = 1; i < count - 1; i++) {
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

        n++;
    }

    double result = (a + b) / 2.0;
    if (f(a) < f(result)) result = a;
    if (f(b) < f(result)) result = b;
    return result;
}
