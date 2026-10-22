import type { MetadataTagReference } from '@server/constants/backendSelection';
import type { MediaType } from '@server/constants/media';
import type { BackendSelectionRecommendationResponse } from '@server/interfaces/api/backendSelectionInterfaces';
import axios from 'axios';
import useSWR from 'swr';

const useBackendSelectionRecommendation = ({
  mediaType,
  is4k,
  tags,
  enabled = true,
}: {
  mediaType: MediaType;
  is4k: boolean;
  tags?: MetadataTagReference[];
  enabled?: boolean;
}) => {
  const tagKey = tags
    ?.map((tag) => `${tag.provider}:${tag.type}:${tag.id}`)
    .sort()
    .join('|');
  const { data, error, isLoading } =
    useSWR<BackendSelectionRecommendationResponse>(
      enabled && tags
        ? [
            '/api/v1/backend-selection-rules/recommendation',
            mediaType,
            is4k,
            tagKey,
          ]
        : null,
      async () => {
        const response =
          await axios.post<BackendSelectionRecommendationResponse>(
            '/api/v1/backend-selection-rules/recommendation',
            {
              mediaType,
              is4k,
              tags: tags?.map((tag) => ({
                provider: tag.provider,
                type: tag.type,
                id: tag.id,
              })),
            }
          );
        return response.data;
      },
      {
        revalidateOnFocus: false,
        revalidateOnReconnect: false,
      }
    );

  return {
    recommendation: data,
    error,
    isLoading,
  };
};

export default useBackendSelectionRecommendation;
