package vector

import (
	"math"
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestVector_Sum(t *testing.T) {
	assert.InDelta(t, 6.0, Vector{1, 2, 3}.Sum(), 0.00001)
	assert.InDelta(t, 0.0, Vector{}.Sum(), 0.00001)
}

func TestVector_Dim(t *testing.T) {
	assert.Equal(t, 3, Vector{1, 2, 3}.Dim())
	assert.Equal(t, 0, Vector{}.Dim())
}

func TestVector_Copy(t *testing.T) {
	a := Vector{1, 2, 3}
	b := a.Copy()
	b[0] = 99
	assert.Equal(t, Vector{1, 2, 3}, a, "modifying the copy must not change the original")
	assert.Equal(t, Vector{99, 2, 3}, b)
}

func TestNullVector(t *testing.T) {
	v := NullVector(3)
	assert.Equal(t, 3, v.Dim())
	assert.Equal(t, Vector{0, 0, 0}, v)
}

func TestNewVector_Float64Copy(t *testing.T) {
	// NewVector must return a vector independent of the source slice.
	src := []float64{1, 2, 3}
	v, err := NewVector(src)
	assert.NoError(t, err)
	src[0] = 99
	assert.Equal(t, Vector{1, 2, 3}, v)
}

func TestVector_Variance(t *testing.T) {
	t.Run("Values", func(t *testing.T) {
		assert.InDelta(t, 32.0/7.0, Vector{2, 4, 4, 4, 5, 5, 7, 9}.Variance(), 0.00001)
	})
	t.Run("Single", func(t *testing.T) {
		assert.InDelta(t, 0.0, Vector{5}.Variance(), 0.00001)
	})
	t.Run("Empty", func(t *testing.T) {
		assert.InDelta(t, 0.0, Vector{}.Variance(), 0.00001)
	})
}

func TestVector_Sd(t *testing.T) {
	assert.InDelta(t, math.Sqrt(32.0/7.0), Vector{2, 4, 4, 4, 5, 5, 7, 9}.Sd(), 0.00001)
	assert.InDelta(t, 0.0, Vector{5}.Sd(), 0.00001)
}

func TestVector_WeightedMean(t *testing.T) {
	t.Run("Values", func(t *testing.T) {
		r, err := Vector{1, 2, 4}.WeightedMean(Vector{1, 0, 1})
		assert.NoError(t, err)
		assert.InDelta(t, 2.5, r, 0.00001)
	})
	t.Run("LengthMismatch", func(t *testing.T) {
		r, err := Vector{1, 2, 4}.WeightedMean(Vector{1, 1})
		assert.Error(t, err)
		assert.True(t, math.IsNaN(r))
	})
}

func TestCor(t *testing.T) {
	t.Run("PerfectPositive", func(t *testing.T) {
		r, err := Cor(Vector{1, 2, 3}, Vector{2, 4, 6})
		assert.NoError(t, err)
		assert.InDelta(t, 1.0, r, 0.00001)
	})
	t.Run("LengthMismatch", func(t *testing.T) {
		r, err := Cor(Vector{1, 2, 3}, Vector{1, 2})
		assert.Error(t, err)
		assert.True(t, math.IsNaN(r))
	})
}

func TestNorm(t *testing.T) {
	t.Run("Euclidean", func(t *testing.T) {
		assert.InDelta(t, 5.0, Norm(Vector{3, -4}, 2.0), 0.00001)
	})
	t.Run("Manhattan", func(t *testing.T) {
		// L1 norm uses absolute values, so negatives contribute their magnitude.
		assert.InDelta(t, 5.0, Norm(Vector{1, -2, 2}, 1.0), 0.00001)
	})
}

func TestProduct(t *testing.T) {
	t.Run("Values", func(t *testing.T) {
		p, err := Product(Vector{1, 2, 3}, Vector{4, 5, 6})
		assert.NoError(t, err)
		assert.Equal(t, Vector{4, 10, 18}, p)
	})
	t.Run("LengthMismatch", func(t *testing.T) {
		p, err := Product(Vector{1, 2, 3}, Vector{4, 5})
		assert.Error(t, err)
		assert.Nil(t, p)
	})
}

func TestDotProduct(t *testing.T) {
	t.Run("Values", func(t *testing.T) {
		r, err := DotProduct(Vector{1, 2, 3}, Vector{4, 5, 6})
		assert.NoError(t, err)
		assert.InDelta(t, 32.0, r, 0.00001)
	})
	t.Run("LengthMismatch", func(t *testing.T) {
		r, err := DotProduct(Vector{1, 2, 3}, Vector{4, 5})
		assert.Error(t, err)
		assert.True(t, math.IsNaN(r))
	})
}

func TestCosineSimilarity(t *testing.T) {
	t.Run("Orthogonal", func(t *testing.T) {
		assert.InDelta(t, 0.0, CosineSimilarity(Vector{1, 0}, Vector{0, 1}), 0.00001)
		assert.InDelta(t, 1.0, CosineDist(Vector{1, 0}, Vector{0, 1}), 0.00001)
	})
	t.Run("Opposite", func(t *testing.T) {
		assert.InDelta(t, -1.0, CosineSimilarity(Vector{1, 0}, Vector{-1, 0}), 0.00001)
		assert.InDelta(t, 2.0, CosineDist(Vector{1, 0}, Vector{-1, 0}), 0.00001)
	})
	t.Run("DimensionMismatch", func(t *testing.T) {
		assert.True(t, math.IsNaN(CosineSimilarity(Vector{1, 0}, Vector{1, 0, 0})))
		assert.True(t, math.IsNaN(CosineDist(Vector{1, 0}, Vector{1, 0, 0})))
	})
}

func TestCosineDists(t *testing.T) {
	x := Vectors{{1, 0}, {0, 1}}
	y := Vectors{{1, 0}, {-1, 0}}
	got := CosineDists(x, y)
	assert.Len(t, got, 2)
	assert.InDelta(t, 0.0, got[0][0], 0.00001) // identical
	assert.InDelta(t, 2.0, got[0][1], 0.00001) // opposite
	assert.InDelta(t, 1.0, got[1][0], 0.00001) // orthogonal
	assert.InDelta(t, 1.0, got[1][1], 0.00001) // orthogonal
}
