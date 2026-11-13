#include "matrix.hpp"

MyMatrix<double> gauss_jordan_solver(const MyMatrix<double> &matrix) {
    MyMatrix<double> matrix = data;
    for(int i = 0; i  < matrix.ncols() ; i++) {
        int j = 0;
        while(matrix[i][j] == 0 && j < matrix.ncols()) ++j;
        if(j >= matrix.ncols()) continue;
        int k = 0;
        while(k < matrix.ncols()) 
            matrix[i][k] /= matrix[i][j];
        for(int k = 0; k < matrix.ncols(); ++k) {
            if(k != i){
                MyMatrix<double> row(1, matrix.ncols());
                for(int a = 0; a < matrix.ncols(); ++a)
                    row[0][a] = -matrix[k][j] * matrix[i][a];
                for(int a = 0; a < matrix.ncols(); ++a)
                    matrix[k][a] += row[0][a];
            }
        }
    }
    return matrix; 
}