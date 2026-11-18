#pragma once
#include <cmath>
#include <vector>

template <typename Function>
double min_uniform_search(double a, double b, double eps, Function f, int& iterations) {
    double min_x = a;
    double step = eps / 2.0;
    iterations = 0;

    for (double x = a; x <= b; x += step) {
        if (f(x) < f(min_x)) min_x = x;
        iterations++;
    }

    if (f(b) < f(min_x)) min_x = b;
    return min_x;
}

template <typename Function>
double min_local(double a, double b, double eps, Function f, int& iterations) {
    iterations = 0;
    double step = (b - a) / 10.0;

    if (f(a) <= f(a + step)) { iterations = 1; return a; }
    if (f(b) <= f(b - step)) { iterations = 1; return b; }

    double x1 = a;
    double x2 = a + step;
    double x3 = x2 + step;
    iterations += 2;

    while (x3 < b && f(x3) < f(x2)) {
        x1 = x2;
        x2 = x3;
        x3 += step;
        iterations++;
    }

    if (x3 > b) x3 = b;

    double left = x1;
    double right = x3;
    while (right - left > 2 * eps) {
        double middle = (left + right) / 2.0;
        if (f(middle - eps) < f(middle + eps)) right = middle;
        else left = middle;
        iterations++;
    }

    return (left + right) / 2.0;
}

template <typename Function>
double min_dihotomia(double a, double b, double eps, Function f, int& iterations) {
    iterations = 0;
    double start_a = a;
    double start_b = b;
    double delta = eps / 2.0;

    while (b - a > 2 * eps) {
        double middle = (a + b) / 2.0;
        double x1 = middle - delta;
        double x2 = middle + delta;

        if (f(x1) <= f(x2)) b = x2;
        else a = x1;
        iterations++;
    }

    double result = (a + b) / 2.0;
    if (f(start_a) < f(result)) result = start_a;
    if (f(start_b) < f(result)) result = start_b;
    return result;
}

template <typename Function>
double min_golden_ration(double a, double b, double eps, Function f, int& iterations) {
    const double ratio = (std::sqrt(5.0) - 1.0) / 2.0;
    iterations = 0;
    double start_a = a;
    double start_b = b;

    double x1 = b - ratio * (b - a);
    double x2 = a + ratio * (b - a);
    double f1 = f(x1);
    double f2 = f(x2);

    while (b - a > eps) {
        if (f1 <= f2) {
            b = x2;
            x2 = x1;
            f2 = f1;
            x1 = b - ratio * (b - a);
            f1 = f(x1);
        } else {
            a = x1;
            x1 = x2;
            f1 = f2;
            x2 = a + ratio * (b - a);
            f2 = f(x2);
        }
        iterations++;
    }

    double result = (a + b) / 2.0;
    if (f(start_a) < f(result)) result = start_a;
    if (f(start_b) < f(result)) result = start_b;
    return result;
}

template <typename Function>
double min_Fibonacci(double a, double b, double eps, Function f, int& iterations) {
    iterations = 0;
    double start_a = a;
    double start_b = b;
    std::vector<unsigned long long> fib(2, 1);
    while (fib.back() < static_cast<unsigned long long>((b - a) / eps)) {
        fib.push_back(fib[fib.size() - 1] + fib[fib.size() - 2]);
    }

    int n = static_cast<int>(fib.size()) - 1;
    double x1 = a + static_cast<double>(fib[n - 2]) / fib[n] * (b - a);
    double x2 = a + static_cast<double>(fib[n - 1]) / fib[n] * (b - a);
    double f1 = f(x1);
    double f2 = f(x2);

    for (int k = 1; k < n - 1 && b - a > eps; k++) {
        if (f1 <= f2) {
            b = x2;
            x2 = x1;
            f2 = f1;
            x1 = a + static_cast<double>(fib[n - k - 2]) / fib[n - k] * (b - a);
            f1 = f(x1);
        } else {
            a = x1;
            x1 = x2;
            f1 = f2;
            x2 = a + static_cast<double>(fib[n - k - 1]) / fib[n - k] * (b - a);
            f2 = f(x2);
        }
        iterations++;
    }

    double result = (a + b) / 2.0;
    if (f(start_a) < f(result)) result = start_a;
    if (f(start_b) < f(result)) result = start_b;
    return result;
}
