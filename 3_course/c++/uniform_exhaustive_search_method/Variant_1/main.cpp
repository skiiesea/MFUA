#include <iostream>
#include <iomanip>
#include <fstream>
#include "functions.h"
#include "plain_methods.h"

const double EPS = 1e-6;
const double GRAPH_EPS = 1e-2;

typedef double (*Function)(double);

struct TestFunction {
    int number;
    Function f;
    double a;
    double b;
    double graph_left;
    double graph_right;
};

int main() {
    TestFunction functions[] = {
        {9, foo9, 1.5707963267948966, 4.71238898038469, 2.141592653589793, 4.141592653589793},
        {14, foo14, -4.0, 0.0, -4.0, -2.0},
        {16, foo16, -1.0, 1.0, -1.0, 0.0},
        {19, foo19, -1.0, 1.0, -1.0, 1.0},
        {27, foo27, -4.0, 0.0, -4.0, 0.0},
        {50, foo50, -2.0, 0.0, -2.0, -1.2}
    };

    std::cout << std::fixed << std::setprecision(8);
    std::cout << "Variant 1, epsilon = " << EPS << "\n\n";

    for (const auto& item : functions) {
        int n = 0;
        double x;
        std::cout << "Function #" << item.number << " on [" << item.a << "; " << item.b << "]\n";

        x = min_uniform_search(item.a, item.b, EPS, item.f, n);
        std::cout << "Uniform:       x = " << x << "  f(x) = " << item.f(x) << "  n = " << n << '\n';
        x = min_local(item.a, item.b, EPS, item.f, n);
        std::cout << "Localization:  x = " << x << "  f(x) = " << item.f(x) << "  n = " << n << '\n';
        x = min_dihotomia(item.a, item.b, EPS, item.f, n);
        std::cout << "Dichotomy:     x = " << x << "  f(x) = " << item.f(x) << "  n = " << n << '\n';
        x = min_golden_ration(item.a, item.b, EPS, item.f, n);
        std::cout << "Golden ratio:  x = " << x << "  f(x) = " << item.f(x) << "  n = " << n << '\n';
        x = min_Fibonacci(item.a, item.b, EPS, item.f, n);
        std::cout << "Fibonacci:     x = " << x << "  f(x) = " << item.f(x) << "  n = " << n << "\n\n";
    }

    std::ofstream csv("iterations.csv");
    csv << "function,method,h,iterations\n";
    const char* methods[] = {"Uniform", "Localization", "Dichotomy", "Golden ratio", "Fibonacci"};

    for (const auto& item : functions) {
        for (int j = 1; j <= 8; j++) {
            double h = (item.graph_right - item.graph_left) * j / 8.0;
            double a = item.graph_left;
            double b = item.graph_right;
            if (item.number == 9) {
                a = 3.141592653589793 - h / 2.0;
                b = 3.141592653589793 + h / 2.0;
            } else {
                b = a + h;
            }

            int n = 0;
            min_uniform_search(a, b, GRAPH_EPS, item.f, n);
            csv << item.number << ',' << methods[0] << ',' << h << ',' << n << '\n';
            min_local(a, b, GRAPH_EPS, item.f, n);
            csv << item.number << ',' << methods[1] << ',' << h << ',' << n << '\n';
            min_dihotomia(a, b, GRAPH_EPS, item.f, n);
            csv << item.number << ',' << methods[2] << ',' << h << ',' << n << '\n';
            min_golden_ration(a, b, GRAPH_EPS, item.f, n);
            csv << item.number << ',' << methods[3] << ',' << h << ',' << n << '\n';
            min_Fibonacci(a, b, GRAPH_EPS, item.f, n);
            csv << item.number << ',' << methods[4] << ',' << h << ',' << n << '\n';
        }
    }

    std::cout << "Graph data saved to iterations.csv (epsilon = " << GRAPH_EPS << ").\n";
    return 0;
}
