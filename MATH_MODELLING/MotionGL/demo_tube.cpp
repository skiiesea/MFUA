// MotionGL - OpenGL animation library for classical mechanics labworks
// Copyright (C) 2026 Stanislav Furmavnin (GitHub: saintninja)
// SPDX-License-Identifier: GPL-3.0-or-later
//
// This program is free software: you can redistribute it and/or modify
// it under the terms of the GNU General Public License as published by
// the Free Software Foundation, either version 3 of the License, or
// (at your option) any later version.
//
// This program is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
// GNU General Public License for more details.
// You should have received a copy of the GNU General Public License
// along with this program.  If not, see <https://www.gnu.org/licenses/>.

#include <motiongl/tube_animator.hpp>
#include <algorithm>
#include <cmath>
#include <cstdio>
#include <cstdlib>
#include <string>
#include <utility>
#include <vector>

int main(int argc, char **argv) {
    using namespace mgl;
    const int variant = argc > 1 ? std::atoi(argv[1]) : 6;
    const double m = 1.0;
    const double g = 9.81;
    const double f = 0.2;
    const double v0 = 0.0;
    const double alpha = 30.0 * 3.14159265358979323846 / 180.0;
    const double Q = 3.0;       
    const double mu = 0.6;      
    const double t1 = 1.0;      
    const double h = 0.01;
    const auto seg1 = [=](double t) {
        if (mu == 0.0)
            return v0 * t + Q * t * t / (2.0 * m);
        const double k = mu / m;
        const double vLimit = Q / mu;
        return vLimit * t + (v0 - vLimit) * (1.0 - std::exp(-k * t)) / k;
    };
    const double l = seg1(t1);
    const double vB = (mu == 0.0)
        ? v0 + Q * t1 / m
        : Q / mu + (v0 - Q / mu) * std::exp(-mu * t1 / m);
    std::vector<std::pair<double, double>> seg2;
    double tau = 0.0;
    double x = 0.0;
    double v = vB;
    const double t2 = 0.8;
    auto acceleration = [=](double time, double speed) {
        const double friction = f * m * g * std::cos(alpha) * (speed > 0.0 ? 1.0 : (speed < 0.0 ? -1.0 : 0.0));
        const double force = 9.0 * time * time + m * g * std::sin(alpha);
        return (force - friction) / m;
    };
    seg2.emplace_back(0.0, 0.0);
    while (tau < t2 - 1e-9) {
        const double step = std::min(h, t2 - tau);
        const double k1x = v;
        const double k1v = acceleration(tau, v);
        const double k2x = v + 0.5 * step * k1v;
        const double k2v = acceleration(tau + 0.5 * step, v + 0.5 * step * k1v);
        const double k3x = v + 0.5 * step * k2v;
        const double k3v = acceleration(tau + 0.5 * step, v + 0.5 * step * k2v);
        const double k4x = v + step * k3v;
        const double k4v = acceleration(tau + step, v + step * k3v);
        x += step / 6.0 * (k1x + 2.0 * k2x + 2.0 * k3x + k4x);
        v += step / 6.0 * (k1v + 2.0 * k2v + 2.0 * k3v + k4v);
        tau += step;
        seg2.emplace_back(tau, x);
    }
    std::printf("Variant: %d\n", variant);
    std::printf("AB: length = %.3f m, time = %.2f s, speed at B = %.3f m/s\n", l, t1, vB);
    std::printf("BC: length at end = %.3f m, time = %.2f s\n", x, t2);
    TubeAnimator anim = TubeAnimatorBuilder()
                            .size(1100, 640)
                            .title("LAB 2 - Variant 6: motion in tube ABC")
                            .variant(6)
                            .l(l)
                            .timeScale(0.6)
                            .loop(true)
                            .build();

    anim.run(seg1, seg2, t2);
    return 0;
}