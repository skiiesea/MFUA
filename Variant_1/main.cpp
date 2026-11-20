#include <iostream>
#include <fstream>
#include <iomanip>
#include <numbers>
#include "functions.h"
#include "plain_methods.h"

template <typename Function>
void collect_data(std::ofstream& file, int number, Function f,
                  double a, double b, int mode) {
    const double eps = 1e-4;
    int n = 0;

    for (int i = 1; i <= 10; i++) {
        double h = (b - a) * i / 10.0;
        double left = a;
        double right = b;

        if (mode == 0) {
            double middle = (a + b) / 2.0;
            left = middle - h / 2.0;
            right = middle + h / 2.0;
        }
        else if (mode == 1) {
            left = b - h;
            right = b;
        }
        else {
            left = a;
            right = a + h;
        }

        min_uniform_search(left, right, eps, f, n);
        file << number << ",Uniform," << h << "," << eps << "," << n << '\n';

        min_local(left, right, eps, f, n);
        file << number << ",Localization," << h << "," << eps << "," << n << '\n';

        min_dihotomia(left, right, eps, f, n);
        file << number << ",Dichotomy," << h << "," << eps << "," << n << '\n';

        min_golden_nation(left, right, eps, f, n);
        file << number << ",Golden," << h << "," << eps << "," << n << '\n';

        min_Fibonacci(left, right, eps, f, n);
        file << number << ",Fibonacci," << h << "," << eps << "," << n << '\n';
    }
}

int main() {
    std::ofstream file("iteration_width_data.csv");

    if (!file.is_open()) {
        std::cout << "Cannot create CSV file" << std::endl;
        return 1;
    }

    file << "function,method,h,epsilon,iterations\n";
    file << std::fixed << std::setprecision(8);

    // mode 0 - minimum in the middle, mode 1 - at the right edge,
    // mode 2 - at the left edge.
    collect_data(file, 9, foo9, std::numbers::pi / 2,
                 3 * std::numbers::pi / 2, 0);
    collect_data(file, 14, foo14, -std::sqrt(3.0), 0, 1);
    collect_data(file, 16, foo16, 0, 1, 1);
    collect_data(file, 19, foo19, -1, 1, 2);
    collect_data(file, 27, foo27, -4, 0, 1);
    collect_data(file, 50, foo50, -2, -1.1, 2);

    file.close();

    std::cout << "Data saved to iteration_width_data.csv" << std::endl;
    std::cout << "Rows: 300 (6 functions x 10 widths x 5 methods)" << std::endl;

    return 0;
}
