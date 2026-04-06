from __future__ import annotations

from typing import Any

from pydantic import BaseModel, ConfigDict, Field, HttpUrl, field_validator, model_validator


class ApiErrorResponse(BaseModel):
    error: str
    details: list[dict[str, Any]] | None = None


class TfIdfConfig(BaseModel):
    model_config = ConfigDict(extra='forbid')

    min_df: int | float = Field(default=1)
    max_df: int | float = Field(default=1.0)
    max_features: int = Field(default=5000, ge=1, le=50000)
    ngram_range: tuple[int, int] = Field(default=(1, 2))

    @field_validator('min_df', 'max_df')
    @classmethod
    def validate_df(cls, value: int | float) -> int | float:
        if isinstance(value, int):
            if value < 1 or value > 10000:
                raise ValueError('Debe ser entero entre 1 y 10000, o flotante entre 0 y 1.')
            return value

        if value <= 0 or value > 1:
            raise ValueError('Debe ser entero entre 1 y 10000, o flotante entre 0 y 1.')
        return value

    @field_validator('ngram_range')
    @classmethod
    def validate_ngram_range(cls, value: tuple[int, int]) -> tuple[int, int]:
        if len(value) != 2:
            raise ValueError('Debe incluir exactamente dos enteros: [min_n, max_n].')

        min_n, max_n = value
        if min_n < 1 or max_n > 4:
            raise ValueError('Los valores permitidos para ngram_range son entre 1 y 4.')
        if min_n > max_n:
            raise ValueError('El primer valor de ngram_range no puede ser mayor que el segundo.')
        return value

    @model_validator(mode='after')
    def validate_df_pair(self) -> 'TfIdfConfig':
        min_df = float(self.min_df)
        max_df = float(self.max_df)
        if min_df > max_df:
            raise ValueError('min_df no puede ser mayor que max_df.')
        return self


class CreateProjectRequest(BaseModel):
    model_config = ConfigDict(extra='forbid')

    name: str = Field(default='Untitled TF-IDF Project', min_length=1, max_length=120)


class ProjectSummary(BaseModel):
    id: str
    name: str
    created_at: str
    updated_at: str
    documents_count: int
    runs_count: int


class CreateProjectResponse(BaseModel):
    id: str
    name: str
    created_at: str
    updated_at: str
    documents: list[dict[str, Any]]
    runs: list[str]


class AddDocumentItem(BaseModel):
    model_config = ConfigDict(extra='forbid')

    title: str = Field(default='Documento sin título', min_length=1, max_length=200)
    content: str = Field(min_length=1)


class AddDocumentsRequest(BaseModel):
    model_config = ConfigDict(extra='forbid')

    documents: list[AddDocumentItem] = Field(min_length=1)


class DocumentResponse(BaseModel):
    id: str
    title: str
    content: str
    created_at: str


class AddDocumentsResponse(BaseModel):
    project_id: str
    inserted: list[DocumentResponse]
    count: int


class AnalyzeRequest(BaseModel):
    model_config = ConfigDict(extra='forbid')

    target_url: HttpUrl
    reference_urls: list[HttpUrl] = Field(min_length=1)
    config: TfIdfConfig = Field(default_factory=TfIdfConfig)


class TermScore(BaseModel):
    term: str
    tf: float
    idf: float
    score: float
    frequency: int


class DocumentAnalysis(BaseModel):
    document_id: str
    token_count: int
    top_terms: list[TermScore]


class AnalyzeResponse(BaseModel):
    run_id: str
    project_id: str
    status: str
    created_at: str
    documents_analyzed: int
    summary: str
    recommendations: list[str]
    terms: list[TermScore]
    analysis: list[DocumentAnalysis]


class RunDetailResponse(AnalyzeResponse):
    target_url: str
    reference_urls: list[str]
    config: TfIdfConfig


class ListProjectsResponse(BaseModel):
    projects: list[ProjectSummary]
    count: int


class ListRunsResponse(BaseModel):
    project_id: str
    runs: list[RunDetailResponse]
    count: int
